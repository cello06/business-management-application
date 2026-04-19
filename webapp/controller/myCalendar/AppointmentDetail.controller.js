sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Fragment, JSONModel, MessageToast, MessageBox) {
  "use strict";

  var mTypeLabel = {
    "TYPE01": "Work", "TYPE02": "Available", "TYPE03": "Meeting",
    "TYPE05": "Personal", "TYPE07": "Social", "TYPE08": "Urgent", "TYPE09": "Reminder"
  };
  var mTypeColor = {
    "TYPE01": "#3C5CB0", "TYPE02": "#30913C", "TYPE03": "#009DA8",
    "TYPE05": "#E8762B", "TYPE07": "#D36FB4", "TYPE08": "#D20A0A",
    "TYPE09": "#8D5BC3"
  };
  function normKey(s) { return (s || "").toUpperCase(); }

  return Controller.extend("hrproject.controller.myCalendar.AppointmentDetail", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        busy          : false,
        entryId       : "",
        title         : "",
        description   : "",
        typeRaw       : "TYPE01",
        typeLabel     : "",
        typeColor     : "#6A6D70",
        startDate     : null,
        endDate       : null,
        startFormatted: "",
        endFormatted  : "",
        durationText  : ""
      }), "detail");

      this.getOwnerComponent().getRouter()
        .getRoute("RouteAppointmentDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      this._sPersId  = oArgs.persId;
      this._sEntryId = oArgs.entryId;
      this._load();
    },

    // ── Load the single entry ──────────────────────────────────────────────
    _load: function () {
      var oOData = this.getView().getModel();
      var oVm    = this.getView().getModel("detail");
      var that   = this;

      oVm.setProperty("/busy", true);
      oOData.read("/Timesheets('" + this._sEntryId + "')", {
        success: function (oData) {
          var sKey   = normKey(oData.Type);
          var oStart = that._toDate(oData.StartDate, oData.StartTime);
          var oEnd   = that._toDate(oData.EndDate,   oData.EndTime);

          oVm.setData({
            busy          : false,
            entryId       : oData.EntryId,
            title         : oData.Title,
            description   : oData.Description || "",
            typeRaw       : sKey,
            typeLabel     : mTypeLabel[sKey] || "Other",
            typeColor     : mTypeColor[sKey] || "#6A6D70",
            startDate     : oStart,
            endDate       : oEnd,
            startFormatted: that._fmtDateTime(oStart),
            endFormatted  : that._fmtDateTime(oEnd),
            durationText  : that._fmtDuration(oStart, oEnd)
          });

          // Keep SAP username in case we edit later
          that._sSapUsername = oData.SapUsername || "";
        },
        error: function () {
          oVm.setProperty("/busy", false);
          MessageBox.error("Could not load this appointment.");
        }
      });
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteMyAppointments", {
        persId: this._sPersId
      });
    },

    onOpenInCalendar: function () {
      var oVm   = this.getView().getModel("detail");
      var oDate = oVm.getProperty("/startDate");
      var oParams = { persId: this._sPersId };
      if (oDate && !isNaN(oDate.getTime())) {
        oParams["?query"] = { focusDate: oDate.toISOString() };
      }
      this.getOwnerComponent().getRouter().navTo("RouteMyCalendar", oParams);
    },

    // ── Edit ───────────────────────────────────────────────────────────────
    onEditAppointment: function () {
      var oVm = this.getView().getModel("detail");
      this._openDialog(function () {
        this._oDialog.setTitle("Edit Appointment");
        var sRaw    = oVm.getProperty("/typeRaw") || "TYPE01";
        var sTypeKey = sRaw.charAt(0).toUpperCase() + sRaw.slice(1).toLowerCase();
        this._setDialogValues(
          oVm.getProperty("/title"),
          oVm.getProperty("/description"),
          sTypeKey,
          oVm.getProperty("/startDate"),
          oVm.getProperty("/endDate")
        );
      }.bind(this));
    },

    _openDialog: function (fnAfterOpen) {
      if (!this._oDialog) {
        Fragment.load({
          id        : this.getView().getId(),
          name      : "hrproject.view.myCalendar.AppointmentDialog",
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

    // ── Dialog actions (matched to AppointmentDialog.fragment.xml) ────────
    onSaveAppointment: function () {
      var sTitle    = this._getField("apptTitle")    ? this._getField("apptTitle").getValue().trim()  : "";
      var sDesc     = this._getField("apptDesc")     ? this._getField("apptDesc").getValue().trim()   : "";
      var sType     = this._getField("apptType")     ? this._getField("apptType").getSelectedKey()    : "Type01";
      var oDateFrom = this._getField("apptDateFrom") ? this._getField("apptDateFrom").getDateValue()  : null;
      var oDateTo   = this._getField("apptDateTo")   ? this._getField("apptDateTo").getDateValue()    : null;
      var oTimeFrom = this._getField("apptTimeFrom") ? this._getField("apptTimeFrom").getDateValue()  : null;
      var oTimeTo   = this._getField("apptTimeTo")   ? this._getField("apptTimeTo").getDateValue()    : null;

      if (!sTitle)                 { MessageToast.show("Please enter a title."); return; }
      if (!oDateFrom || !oDateTo)  { MessageToast.show("Please select dates.");  return; }

      var oStart = new Date(oDateFrom);
      oStart.setHours(oTimeFrom ? oTimeFrom.getHours() : 0, oTimeFrom ? oTimeFrom.getMinutes() : 0, 0, 0);
      var oEnd = new Date(oDateTo);
      oEnd.setHours(oTimeTo ? oTimeTo.getHours() : 1, oTimeTo ? oTimeTo.getMinutes() : 0, 0, 0);

      var that = this;
      this.getView().getModel().update("/Timesheets('" + this._sEntryId + "')", {
        Title    : sTitle,
        Description: sDesc,
        Type     : sType,
        StartDate: this._toODataDate(oStart),
        EndDate  : this._toODataDate(oEnd),
        StartTime: this._toTimeStr(oStart),
        EndTime  : this._toTimeStr(oEnd)
      }, {
        success: function () {
          MessageToast.show("Updated!");
          that._oDialog.close();
          that._load();
        },
        error: function (oErr) {
          console.error("Update failed:", oErr && oErr.responseText);
          MessageBox.error("Failed to update.");
        }
      });
    },

    onDeleteAppointment: function () {
      var that = this;
      MessageBox.confirm("Delete this appointment?", {
        title: "Confirm Delete",
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          that.getView().getModel().remove("/Timesheets('" + that._sEntryId + "')", {
            success: function () {
              MessageToast.show("Deleted.");
              if (that._oDialog) { that._oDialog.close(); }
              // After delete, go back to the list
              that.getOwnerComponent().getRouter().navTo("RouteMyAppointments", {
                persId: that._sPersId
              });
            },
            error: function () { MessageBox.error("Failed to delete."); }
          });
        }
      });
    },

    onCancelAppointment: function () {
      if (this._oDialog) { this._oDialog.close(); }
    },

    // ── Helpers (copied from MyCalendar / MyAppointments) ─────────────────
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
      var iH = 0, iMi = 0;
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

    _fmtDateTime: function (oDate) {
      if (!oDate) { return ""; }
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return pad(oDate.getDate()) + "." + pad(oDate.getMonth() + 1) + "." + oDate.getFullYear() +
             "  " + pad(oDate.getHours()) + ":" + pad(oDate.getMinutes());
    },

    _fmtDuration: function (oStart, oEnd) {
      if (!oStart || !oEnd) { return ""; }
      var iMin = Math.max(0, Math.round((oEnd - oStart) / 60000));
      if (iMin < 60) { return iMin + " min"; }
      var iHr = Math.floor(iMin / 60), iRem = iMin % 60;
      return iRem ? (iHr + "h " + iRem + "m") : (iHr + "h");
    }

  });
});
