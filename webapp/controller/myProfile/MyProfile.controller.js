sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/format/DateFormat",
  "hrproject/model/formatter",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, UIComponent, JSONModel, DateFormat, formatter, MessageToast, MessageBox) {
  "use strict";

  var DASH = "–";  // en-dash — used as the "empty value" placeholder
  var oDateFmt = DateFormat.getDateInstance({ style: "medium" });

  // "/Date(ms)/" | Date | string → JS Date | null
  function parseODataDate(v) {
    if (!v) { return null; }
    if (v instanceof Date) { return v; }
    if (typeof v === "string" && v.indexOf("/Date(") !== -1) {
      var m = v.match(/\/Date\((-?\d+)\)\//);
      return m ? new Date(parseInt(m[1], 10)) : null;
    }
    var oParsed = new Date(v);
    return isNaN(oParsed.getTime()) ? null : oParsed;
  }

  // Guess mime type from the first bytes of a base64 payload so the
  // data-URL prefix we add on display matches the original upload.
  function guessMimeFromBase64(sB64) {
    if (!sB64) { return "image/jpeg"; }
    if (sB64.charAt(0) === "/") { return "image/jpeg"; }   // JPEG magic 0xFF 0xD8
    if (sB64.indexOf("iVBOR") === 0) { return "image/png"; }
    if (sB64.indexOf("R0lGOD") === 0) { return "image/gif"; }
    return "image/jpeg";
  }

  function toDataUrl(sB64) {
    if (!sB64) { return ""; }
    return "data:" + guessMimeFromBase64(sB64) + ";base64," + sB64;
  }

  function initialsFor(sFirst, sLast) {
    var a = (sFirst || "").trim();
    var b = (sLast  || "").trim();
    var i = (a ? a.charAt(0) : "") + (b ? b.charAt(0) : "");
    return i.toUpperCase() || "?";
  }

  return Controller.extend("hrproject.controller.myProfile.MyProfile", {
    formatter: formatter,

    // ── View formatters (bound from XML via ".formatProfile*") ────────────
    formatProfileValue: function (v) {
      if (v === undefined || v === null) { return DASH; }
      var s = String(v).trim();
      return s ? s : DASH;
    },

    formatProfileGender: function (s) {
      if (s === "M") { return "Male"; }
      if (s === "F") { return "Female"; }
      return DASH;
    },

    formatProfileDate: function (v) {
      if (!v) { return DASH; }
      var oDate = (v instanceof Date) ? v : new Date(v);
      if (isNaN(oDate.getTime())) { return DASH; }
      return oDateFmt.format(oDate);
    },

    // _Sector.SectorName preferred → fall back to "Team <id>" → en-dash
    formatProfileTeam: function (sName, vTeamId) {
      if (sName && String(sName).trim()) { return String(sName).trim(); }
      if (vTeamId !== undefined && vTeamId !== null && String(vTeamId).trim()) {
        return "Team " + vTeamId;
      }
      return DASH;
    },

    onInit: function () {
      var oProfile = new JSONModel({
        busy         : false,
        editMode     : false,
        persId       : "",
        sapUsername  : "",
        firstName    : "",
        lastName     : "",
        title        : "",
        email        : "",
        phone        : "",
        gender       : "",
        birthDate    : null,
        teamId       : "",
        teamName     : "",
        managerId    : "",
        startDate    : null,
        endDate      : null,
        status       : "",
        photoBase64  : "",
        photoDataUrl : "",
        initials     : "?"
      });
      this.getView().setModel(oProfile, "profile");

      UIComponent.getRouterFor(this)
        .getRoute("RouteMyProfile")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oComp = this.getOwnerComponent();
      var sRoutePersId = oEvent.getParameter("arguments").persId;
      // Component cache wins when available — same pattern as every other controller
      this._sPersId      = oComp._sPersId      || sRoutePersId;
      this._sSapUsername = oComp._sSapUsername || "";

      this._loadProfile();
    },

    _loadProfile: function () {
      var oModel   = this.getView().getModel();
      var oProfile = this.getView().getModel("profile");
      var that     = this;

      oProfile.setProperty("/busy", true);
      oProfile.setProperty("/editMode", false);

      oModel.read("/Employees('" + this._sPersId + "')", {
        urlParameters: { "$expand": "_Sector" },
        success: function (oData) {
          that._applyEmployeeToModel(oData);
          oProfile.setProperty("/busy", false);
        },
        error: function (oErr) {
          oProfile.setProperty("/busy", false);
          console.error("Profile read failed:", oErr && oErr.responseText);
          // Retry without $expand — some backends reject the association path
          oModel.read("/Employees('" + that._sPersId + "')", {
            success: function (oData) {
              that._applyEmployeeToModel(oData);
            },
            error: function (oErr2) {
              console.error("Profile read retry failed:", oErr2 && oErr2.responseText);
              MessageBox.error("Could not load your profile.");
            }
          });
        }
      });
    },

    _applyEmployeeToModel: function (oEmp) {
      var oProfile = this.getView().getModel("profile");
      var sPhoto   = oEmp.PhotoUrl || "";
      var sFirst   = oEmp.FirstName || "";
      var sLast    = oEmp.LastName  || "";
      var sTeamName = "";
      if (oEmp._Sector && typeof oEmp._Sector === "object" && !oEmp._Sector.__deferred) {
        sTeamName = oEmp._Sector.SectorName || "";
      }

      oProfile.setData({
        busy         : false,
        editMode     : false,
        persId       : oEmp.PersId || "",
        sapUsername  : oEmp.SapUsername || "",
        firstName    : sFirst,
        lastName     : sLast,
        title        : oEmp.Title || "",
        email        : oEmp.Email || "",
        phone        : oEmp.Phone || "",
        gender       : oEmp.Gender || "",
        birthDate    : parseODataDate(oEmp.BirthDate),
        teamId       : oEmp.TeamId ? String(oEmp.TeamId) : "",
        teamName     : sTeamName,
        managerId    : oEmp.ManagerId || "",
        startDate    : parseODataDate(oEmp.StartDate),
        endDate      : parseODataDate(oEmp.EndDate),
        status       : oEmp.Status || "",
        photoBase64  : sPhoto,
        photoDataUrl : toDataUrl(sPhoto),
        initials     : initialsFor(sFirst, sLast)
      });

      // Snapshot of original values — restored when the user hits Cancel
      this._oOriginal = {
        firstName: sFirst,
        lastName : sLast,
        title    : oEmp.Title || "",
        email    : oEmp.Email || "",
        phone    : oEmp.Phone || "",
        gender   : oEmp.Gender || "",
        birthDate: parseODataDate(oEmp.BirthDate)
      };

      // Backfill the team name when $expand didn't return it but we have a TeamId
      if (!sTeamName && oEmp.TeamId) {
        this._resolveTeamName(oEmp.TeamId);
      }
    },

    _resolveTeamName: function (vTeamId) {
      var oProfile = this.getView().getModel("profile");
      this.getView().getModel().read("/Sectors(" + vTeamId + ")", {
        success: function (oSector) {
          if (oSector && oSector.SectorName) {
            oProfile.setProperty("/teamName", oSector.SectorName);
          }
        },
        error: function (oErr) {
          console.warn("Sector lookup failed:", oErr && oErr.responseText);
        }
      });
    },

    // ── Edit / Cancel / Save ──────────────────────────────────────────────
    onEdit: function () {
      this.getView().getModel("profile").setProperty("/editMode", true);
    },

    onCancel: function () {
      var oProfile = this.getView().getModel("profile");
      if (this._oOriginal) {
        oProfile.setProperty("/firstName", this._oOriginal.firstName);
        oProfile.setProperty("/lastName",  this._oOriginal.lastName);
        oProfile.setProperty("/title",     this._oOriginal.title);
        oProfile.setProperty("/email",     this._oOriginal.email);
        oProfile.setProperty("/phone",     this._oOriginal.phone);
        oProfile.setProperty("/gender",    this._oOriginal.gender);
        oProfile.setProperty("/birthDate", this._oOriginal.birthDate);
        oProfile.setProperty("/initials",
          initialsFor(this._oOriginal.firstName, this._oOriginal.lastName));
      }
      oProfile.setProperty("/editMode", false);
    },

    onSave: function () {
      var oProfile = this.getView().getModel("profile");
      var sFirst   = (oProfile.getProperty("/firstName") || "").trim();
      var sLast    = (oProfile.getProperty("/lastName") || "").trim();

      if (!sFirst || !sLast) {
        MessageToast.show("First name and last name are required.");
        return;
      }

      var oBirth = oProfile.getProperty("/birthDate");
      var oBirthUTC = oBirth
        ? new Date(Date.UTC(oBirth.getFullYear(), oBirth.getMonth(), oBirth.getDate()))
        : null;

      var oPayload = {
        FirstName: sFirst,
        LastName : sLast,
        Title    : (oProfile.getProperty("/title") || "").trim(),
        Email    : (oProfile.getProperty("/email") || "").trim(),
        Phone    : (oProfile.getProperty("/phone") || "").trim(),
        Gender   : oProfile.getProperty("/gender") || "",
        BirthDate: oBirthUTC
      };

      this._updateEmployee(oPayload, function () {
        MessageToast.show("Profile saved.");
        oProfile.setProperty("/editMode", false);
        oProfile.setProperty("/initials", initialsFor(sFirst, sLast));
        // Refresh original snapshot so a subsequent Cancel reverts to the saved state
        this._oOriginal = {
          firstName: sFirst,
          lastName : sLast,
          title    : oPayload.Title,
          email    : oPayload.Email,
          phone    : oPayload.Phone,
          gender   : oPayload.Gender,
          birthDate: oBirth
        };
      }.bind(this));
    },

    // ── Photo upload ──────────────────────────────────────────────────────
    onAvatarPress: function () {
      var oUploader = this.byId("profilePhotoUploader");
      if (!oUploader) { return; }
      var oDomRef = oUploader.getFocusDomRef
        ? oUploader.getFocusDomRef()
        : oUploader.getDomRef();
      // FileUploader renders a hidden <input type=file> — clicking it opens the picker
      var oInput = oDomRef ? oDomRef.querySelector("input[type=file]") : null;
      if (oInput) { oInput.click(); }
    },

    onPhotoTypeMismatch: function () {
      MessageBox.warning("Please pick a PNG, JPEG, or GIF image.");
    },

    onPhotoSelected: function (oEvent) {
      var oFiles = oEvent.getParameter("files");
      if (!oFiles || !oFiles.length) { return; }
      var oFile = oFiles[0];

      var that     = this;
      var oReader  = new FileReader();
      oReader.onload = function () {
        var sResult = oReader.result || "";
        var iComma  = sResult.indexOf(",");
        var sB64    = iComma >= 0 ? sResult.substring(iComma + 1) : sResult;
        that._saveNewPhoto(sB64, oFile.type || "image/jpeg");
      };
      oReader.onerror = function () {
        MessageBox.error("Could not read the selected file.");
      };
      oReader.readAsDataURL(oFile);

      // Allow re-selecting the same file later
      var oUploader = this.byId("profilePhotoUploader");
      if (oUploader) { oUploader.clear(); }
    },

    _saveNewPhoto: function (sB64, sMime) {
      var oProfile = this.getView().getModel("profile");
      var that     = this;

      this._updateEmployee({ PhotoUrl: sB64 }, function () {
        oProfile.setProperty("/photoBase64", sB64);
        oProfile.setProperty("/photoDataUrl", "data:" + (sMime || "image/jpeg") + ";base64," + sB64);
        MessageToast.show("Photo updated.");
      }, function (sErr) {
        MessageBox.error("Could not save the photo." + (sErr ? "\n\n" + sErr : ""));
      });
    },

    // ── Shared PATCH helper ───────────────────────────────────────────────
    _updateEmployee: function (oPayload, fnOk, fnErr) {
      var oModel   = this.getView().getModel();
      var oProfile = this.getView().getModel("profile");

      oProfile.setProperty("/busy", true);
      oModel.update("/Employees('" + this._sPersId + "')", oPayload, {
        eTag: "*",
        success: function () {
          oProfile.setProperty("/busy", false);
          if (fnOk) { fnOk(); }
        },
        error: function (oErr) {
          oProfile.setProperty("/busy", false);
          console.error("Employee update failed:", oErr && oErr.responseText);
          var sMsg = "";
          try {
            var oResp = JSON.parse(oErr.responseText);
            sMsg = (oResp && oResp.error && oResp.error.message && oResp.error.message.value) || "";
          } catch (e) { /* ignore parse errors */ }
          if (fnErr) { fnErr(sMsg); }
          else { MessageBox.error(sMsg || "Update failed."); }
        }
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteHome");
    }
  });
});
