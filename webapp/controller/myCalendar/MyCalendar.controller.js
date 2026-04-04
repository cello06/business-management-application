sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/ui/unified/library",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Fragment, JSONModel, unifiedLibrary, MessageToast, MessageBox) {
  "use strict";

  // CalendarAppointment.type expects CalendarDayType enum, not a plain string
  var CalendarDayType = unifiedLibrary.CalendarDayType;

  // Map backend TYPE01..TYPE09 strings to CalendarDayType enum values
  var mTypeMap = {
    "Type01": CalendarDayType.Type01,
    "Type02": CalendarDayType.Type02,
    "Type03": CalendarDayType.Type03,
    "Type04": CalendarDayType.Type04,
    "Type05": CalendarDayType.Type05,
    "Type06": CalendarDayType.Type06,
    "Type07": CalendarDayType.Type07,
    "Type08": CalendarDayType.Type08,
    "Type09": CalendarDayType.Type09,
    "TYPE01": CalendarDayType.Type01,
    "TYPE02": CalendarDayType.Type02,
    "TYPE03": CalendarDayType.Type03,
    "TYPE04": CalendarDayType.Type04,
    "TYPE05": CalendarDayType.Type05,
    "TYPE06": CalendarDayType.Type06,
    "TYPE07": CalendarDayType.Type07,
    "TYPE08": CalendarDayType.Type08,
    "TYPE09": CalendarDayType.Type09
  };

  function toCalType(sType) {
    return mTypeMap[sType] || CalendarDayType.Type01;
  }

  return Controller.extend("hrproject.controller.myCalendar.MyCalendar", {

    onInit: function () {
      var oCalModel = new JSONModel({
        startDate   : new Date(),
        appointments: []
      });
      this.getView().setModel(oCalModel, "calModel");

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteMyCalendar")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    // ── Route matched ──────────────────────────────────────────────────────
    _onRouteMatched: function (oEvent) {
      var oComp = this.getOwnerComponent();

      this._sPersId = oEvent.getParameter("arguments").persId;

      this._sSapUsername = oComp._sSapUsername || "";
      if (!this._sSapUsername) {
        try {
          var oHomeModel = oComp.getModel("home");
          if (oHomeModel) {
            this._sSapUsername = oHomeModel.getProperty("/sapUsername") || "";
          }
        } catch (e) { /* ignore */ }
      }

      if (!this._sSapUsername) {
        this._lookupSapUsername();
      }

      console.log("MyCalendar → persId:", this._sPersId, "| username:", this._sSapUsername);

      this._loadAppointments();
    },

    // ── Fallback: resolve SapUsername from Employees ───────────────────────
    _lookupSapUsername: function () {
      var that = this;
      this.getView().getModel().read("/Employees", {
        urlParameters: {
          "$filter": "PersId eq '" + this._sPersId + "'",
          "$select": "SapUsername",
          "$top"   : "1"
        },
        success: function (oData) {
          if (oData.results && oData.results.length > 0) {
            that._sSapUsername = oData.results[0].SapUsername || "";
            console.log("SapUsername resolved:", that._sSapUsername);
          }
        }
      });
    },

    // ── Load appointments → calModel ───────────────────────────────────────
    _loadAppointments: function () {
      var oODataModel = this.getView().getModel();
      var oCalModel   = this.getView().getModel("calModel");
      var that        = this;

      oODataModel.read("/Timesheets", {
        urlParameters: {
          "$filter": "PersId eq '" + this._sPersId + "'"
        },
        success: function (oData) {
          console.log("Timesheets loaded:", oData.results.length);

          var aAppointments = oData.results.map(function (oEntry) {
            return {
              entryId    : oEntry.EntryId,
              title      : oEntry.Title,
              description: oEntry.Description || "",
              // Use enum value — NOT the raw string from backend
              type       : toCalType(oEntry.Type),
              startDate  : that._toDate(oEntry.StartDate, oEntry.StartTime),
              endDate    : that._toDate(oEntry.EndDate,   oEntry.EndTime)
            };
          });

          oCalModel.setProperty("/appointments", aAppointments);
          console.log("calModel updated with", aAppointments.length, "appointments");
        },
        error: function (oErr) {
          console.error("Failed to load:", oErr && oErr.responseText);
        }
      });
    },

    // ── OData DATS + TIMS → JS Date ───────────────────────────────────────
    _toDate: function (sDate, sTime) {
      if (!sDate) { return new Date(); }

      var oDate;
      if (typeof sDate === "string" && sDate.indexOf("/Date(") !== -1) {
        oDate = new Date(parseInt(sDate.replace(/\/Date\((\d+)\)\//, "$1"), 10));
      } else if (typeof sDate === "string" && sDate.length === 8) {
        oDate = new Date(
          parseInt(sDate.slice(0, 4), 10),
          parseInt(sDate.slice(4, 6), 10) - 1,
          parseInt(sDate.slice(6, 8), 10)
        );
      } else {
        oDate = new Date(sDate);
      }

      var iH = 0; var iMi = 0;
      if (sTime) {
        if (typeof sTime === "string" && sTime.indexOf("PT") !== -1) {
          var m = sTime.match(/PT(\d+)H(\d+)M/);
          if (m) { iH = parseInt(m[1], 10); iMi = parseInt(m[2], 10); }
        } else if (typeof sTime === "string" && sTime.length === 6) {
          iH = parseInt(sTime.slice(0, 2), 10); iMi = parseInt(sTime.slice(2, 4), 10);
        } else if (sTime && sTime.ms !== undefined) {
          iH = Math.floor(sTime.ms / 3600000); iMi = Math.floor((sTime.ms % 3600000) / 60000);
        }
      }
      oDate.setHours(iH, iMi, 0, 0);
      return oDate;
    },

    _toTimeStr: function (oDate) {
      return "PT" + String(oDate.getHours()).padStart(2, "0") +
             "H"  + String(oDate.getMinutes()).padStart(2, "0") + "M00S";
    },

    _toODataDate: function (oDate) {
      return "/Date(" + Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate()) + ")/";
    },

    _getNextEntryId: function (fnCallback) {
      this.getView().getModel().read("/Timesheets", {
        urlParameters: { "$select": "EntryId", "$orderby": "EntryId desc", "$top": "1" },
        success: function (oData) {
          var iMax = 0;
          if (oData.results && oData.results.length > 0) {
            iMax = parseInt(oData.results[0].EntryId, 10) || 0;
          }
          fnCallback(String(iMax + 1).padStart(10, "0"));
        },
        error: function () { fnCallback(String(Date.now()).slice(-10)); }
      });
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteHome");
    },

    // ── Drag & Drop ────────────────────────────────────────────────────────
    onAppointmentDrop: function (oEvent) {
      var oAppt      = oEvent.getParameter("appointment");
      var oStartDate = oEvent.getParameter("startDate");
      var oEndDate   = oEvent.getParameter("endDate");
      var oCtx       = oAppt.getBindingContext("calModel");
      var sEntryId   = oCtx ? oCtx.getProperty("entryId") : null;

      oAppt.setStartDate(oStartDate);
      oAppt.setEndDate(oEndDate);

      if (!sEntryId) { MessageToast.show("Moved."); return; }

      var sST = this._toTimeStr(oStartDate);
      var sET = this._toTimeStr(oEndDate);
      this.getView().getModel().update("/Timesheets('" + sEntryId + "')", {
        StartDate: this._toODataDate(oStartDate), EndDate: this._toODataDate(oEndDate),
        StartTime: sST, EndTime: sET
      }, {
        success: function () { MessageToast.show("Moved."); this._loadAppointments(); }.bind(this),
        error  : function () { MessageBox.error("Failed to move."); }
      });
    },

    // ── Resize ─────────────────────────────────────────────────────────────
    onAppointmentResize: function (oEvent) {
      var oAppt      = oEvent.getParameter("appointment");
      var oStartDate = oEvent.getParameter("startDate");
      var oEndDate   = oEvent.getParameter("endDate");
      var oCtx       = oAppt.getBindingContext("calModel");
      var sEntryId   = oCtx ? oCtx.getProperty("entryId") : null;

      oAppt.setStartDate(oStartDate);
      oAppt.setEndDate(oEndDate);

      if (!sEntryId) { MessageToast.show("Resized."); return; }

      var sST = this._toTimeStr(oStartDate);
      var sET = this._toTimeStr(oEndDate);
      this.getView().getModel().update("/Timesheets('" + sEntryId + "')", {
        StartDate: this._toODataDate(oStartDate), EndDate: this._toODataDate(oEndDate),
        StartTime: sST, EndTime: sET
      }, {
        success: function () { MessageToast.show("Resized."); this._loadAppointments(); }.bind(this),
        error  : function () { MessageBox.error("Failed to resize."); }
      });
    },

    // ── Select → edit dialog ───────────────────────────────────────────────
    onAppointmentSelect: function (oEvent) {
      var oAppt = oEvent.getParameter("appointment");
      if (!oAppt) { return; }
      var oCtx = oAppt.getBindingContext("calModel");
      if (!oCtx) { return; }

      this._sEditEntryId = oCtx.getProperty("entryId");
      this._openDialog(function () {
        this._oDialog.setTitle("Edit Appointment");
        // Store raw type key for the Select dropdown
        var sRawType = oCtx.getProperty("type");
        // Convert enum back to key string for Select (e.g. "Type01")
        var sTypeKey = Object.keys(mTypeMap).find(function(k) {
          return k.indexOf("Type") === 0 && mTypeMap[k] === sRawType;
        }) || "Type01";
        this._setDialogValues(
          oCtx.getProperty("title"),
          oCtx.getProperty("description"),
          sTypeKey,
          oCtx.getProperty("startDate"),
          oCtx.getProperty("endDate")
        );
      }.bind(this));
    },

    // ── New Appointment ────────────────────────────────────────────────────
    onCreateAppointment: function () {
      this._sEditEntryId = null;
      this._openDialog(function () {
        this._oDialog.setTitle("New Appointment");
        var oNow = new Date();
        this._setDialogValues("", "", "Type01", oNow, new Date(oNow.getTime() + 3600000));
      }.bind(this));
    },

    _openDialog: function (fnAfterOpen) {
      if (!this._oDialog) {
        Fragment.load({
          id: this.getView().getId(),
          name: "hrproject.view.myCalendar.AppointmentDialog",
          controller: this
        }).then(function (oDialog) {
          this._oDialog = oDialog;
          this.getView().addDependent(oDialog);
          fnAfterOpen();
          oDialog.open();
        }.bind(this));
      } else {
        fnAfterOpen();
        this._oDialog.open();
      }
    },

    _getField: function (sId) {
      return this.byId(sId) || sap.ui.getCore().byId(this.getView().getId() + "--" + sId);
    },

    _setDialogValues: function (sTitle, sDesc, sType, oStart, oEnd) {
      if (this._getField("apptTitle"))    { this._getField("apptTitle").setValue(sTitle); }
      if (this._getField("apptDesc"))     { this._getField("apptDesc").setValue(sDesc); }
      if (this._getField("apptType"))     { this._getField("apptType").setSelectedKey(sType); }
      if (this._getField("apptDateFrom")) { this._getField("apptDateFrom").setDateValue(oStart); }
      if (this._getField("apptDateTo"))   { this._getField("apptDateTo").setDateValue(oEnd); }
      if (this._getField("apptTimeFrom")) { this._getField("apptTimeFrom").setDateValue(oStart); }
      if (this._getField("apptTimeTo"))   { this._getField("apptTimeTo").setDateValue(oEnd); }
    },

    // ── Save ───────────────────────────────────────────────────────────────
    onSaveAppointment: function () {
      var sTitle    = this._getField("apptTitle")    ? this._getField("apptTitle").getValue().trim()  : "";
      var sDesc     = this._getField("apptDesc")     ? this._getField("apptDesc").getValue().trim()   : "";
      var sType     = this._getField("apptType")     ? this._getField("apptType").getSelectedKey()    : "Type01";
      var oDateFrom = this._getField("apptDateFrom") ? this._getField("apptDateFrom").getDateValue()  : null;
      var oDateTo   = this._getField("apptDateTo")   ? this._getField("apptDateTo").getDateValue()    : null;
      var oTimeFrom = this._getField("apptTimeFrom") ? this._getField("apptTimeFrom").getDateValue()  : null;
      var oTimeTo   = this._getField("apptTimeTo")   ? this._getField("apptTimeTo").getDateValue()    : null;

      if (!sTitle)          { MessageToast.show("Please enter a title."); return; }
      if (!oDateFrom || !oDateTo) { MessageToast.show("Please select dates."); return; }

      var oStart = new Date(oDateFrom);
      oStart.setHours(oTimeFrom ? oTimeFrom.getHours() : 0, oTimeFrom ? oTimeFrom.getMinutes() : 0, 0, 0);
      var oEnd = new Date(oDateTo);
      oEnd.setHours(oTimeTo ? oTimeTo.getHours() : 1, oTimeTo ? oTimeTo.getMinutes() : 0, 0, 0);

      if (this._sEditEntryId) {
        this._updateAppointment(this._sEditEntryId, sTitle, sDesc, sType, oStart, oEnd);
      } else {
        this._createAppointment(sTitle, sDesc, sType, oStart, oEnd);
      }
    },

    // ── Create ─────────────────────────────────────────────────────────────
    _createAppointment: function (sTitle, sDesc, sType, oStart, oEnd) {
      var that = this;
      this._getNextEntryId(function (sEntryId) {
        var sST = that._toTimeStr(oStart);
        var sET = that._toTimeStr(oEnd);
        var oPayload = {
          EntryId: sEntryId, PersId: that._sPersId, SapUsername: that._sSapUsername,
          Title: sTitle, Description: sDesc,
          Type: sType,   // Send the key string "Type01" etc. to backend
          StartDate: that._toODataDate(oStart), EndDate: that._toODataDate(oEnd),
          StartTime: sST, EndTime: sET,
          CreatedOn: that._toODataDate(new Date())
        };
        console.log("Creating:", oPayload);
        that.getView().getModel().create("/Timesheets", oPayload, {
          success: function () {
            MessageToast.show("Appointment created!");
            that._oDialog.close();
            that._loadAppointments();
          },
          error: function (oErr) {
            console.error("Create failed:", oErr && oErr.responseText);
            MessageBox.error("Failed to create appointment.");
          }
        });
      });
    },

    // ── Update ─────────────────────────────────────────────────────────────
    _updateAppointment: function (sEntryId, sTitle, sDesc, sType, oStart, oEnd) {
      var that = this;
      var sST = this._toTimeStr(oStart);
      var sET = this._toTimeStr(oEnd);
      this.getView().getModel().update("/Timesheets('" + sEntryId + "')", {
        Title: sTitle, Description: sDesc,
        Type: sType,   // Send key string to backend
        StartDate: this._toODataDate(oStart), EndDate: this._toODataDate(oEnd),
        StartTime: sST, EndTime: sET
      }, {
        success: function () { MessageToast.show("Updated!"); that._oDialog.close(); that._loadAppointments(); },
        error  : function (oErr) { console.error("Update failed:", oErr && oErr.responseText); MessageBox.error("Failed to update."); }
      });
    },

    // ── Delete ─────────────────────────────────────────────────────────────
    onDeleteAppointment: function () {
      if (!this._sEditEntryId) { this._oDialog.close(); return; }
      var that = this;
      MessageBox.confirm("Delete this appointment?", {
        title: "Confirm Delete",
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            that.getView().getModel().remove("/Timesheets('" + that._sEditEntryId + "')", {
              success: function () { MessageToast.show("Deleted."); that._oDialog.close(); that._loadAppointments(); },
              error  : function () { MessageBox.error("Failed to delete."); }
            });
          }
        }
      });
    },

    onCancelAppointment: function () {
      if (this._oDialog) { this._oDialog.close(); }
    }

  });
});