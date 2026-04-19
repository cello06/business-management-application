sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/ui/unified/library",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Fragment, JSONModel, unifiedLibrary, MessageToast, MessageBox) {
  "use strict";

  var CalendarDayType = unifiedLibrary.CalendarDayType;

  var mTypeMap = {
    "Type01": CalendarDayType.Type01, "Type02": CalendarDayType.Type02,
    "Type03": CalendarDayType.Type03, "Type04": CalendarDayType.Type04,
    "Type05": CalendarDayType.Type05, "Type06": CalendarDayType.Type06,
    "Type07": CalendarDayType.Type07, "Type08": CalendarDayType.Type08,
    "Type09": CalendarDayType.Type09,
    "TYPE01": CalendarDayType.Type01, "TYPE02": CalendarDayType.Type02,
    "TYPE03": CalendarDayType.Type03, "TYPE04": CalendarDayType.Type04,
    "TYPE05": CalendarDayType.Type05, "TYPE06": CalendarDayType.Type06,
    "TYPE07": CalendarDayType.Type07, "TYPE08": CalendarDayType.Type08,
    "TYPE09": CalendarDayType.Type09
  };

  var mTypeLabel = {
    "TYPE01": "Work", "TYPE02": "Available", "TYPE03": "Meeting",
    "TYPE05": "Personal", "TYPE07": "Social", "TYPE08": "Urgent", "TYPE09": "Reminder"
  };

  // Map to sap.ui.core.ValueState for ObjectStatus
  var mTypeState = {
    "TYPE01": "None", "TYPE02": "Success", "TYPE03": "Information",
    "TYPE05": "Warning", "TYPE07": "None", "TYPE08": "Error", "TYPE09": "Warning"
  };

  function toCalType(sType) {
    return mTypeMap[sType] || CalendarDayType.Type01;
  }

  function normKey(sType) {
    return (sType || "").toUpperCase();
  }

  function startOfDay(oDate) {
    var d = new Date(oDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  return Controller.extend("hrproject.controller.myCalendar.MyCalendar", {

    onInit: function () {
      var oCalModel = new JSONModel({
        startDate    : new Date(),
        appointments : [],
        today        : [],
        upcoming     : [],
        todayCount   : 0,
        upcomingCount: 0
      });
      this.getView().setModel(oCalModel, "calModel");

      this._oSelectedDate = null;
      this._oVisibleStart = new Date();

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteMyCalendar")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    // ── Route matched ──────────────────────────────────────────────────────
    _onRouteMatched: function (oEvent) {
      var oComp = this.getOwnerComponent();
      var oArgs = oEvent.getParameter("arguments") || {};

      this._sPersId = oArgs.persId;

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

      // Focus a specific date if the list page asked for one (?focusDate=...)
      var oQuery = oArgs["?query"];
      if (oQuery && oQuery.focusDate) {
        var oFocus = new Date(oQuery.focusDate);
        if (!isNaN(oFocus.getTime())) {
          this.getView().getModel("calModel").setProperty("/startDate", oFocus);
          this._oVisibleStart = oFocus;
        }
      }

      this._loadAppointments();
    },

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
          var aAppointments = oData.results.map(function (oEntry) {
            var sKey = normKey(oEntry.Type);
            return {
              entryId    : oEntry.EntryId,
              title      : oEntry.Title,
              description: oEntry.Description || "",
              type       : toCalType(oEntry.Type),
              typeRaw    : oEntry.Type,
              typeLabel  : mTypeLabel[sKey] || "Other",
              typeState  : mTypeState[sKey] || "None",
              startDate  : that._toDate(oEntry.StartDate, oEntry.StartTime),
              endDate    : that._toDate(oEntry.EndDate,   oEntry.EndTime)
            };
          });

          oCalModel.setProperty("/appointments", aAppointments);
          that._rebuildSidebar(aAppointments);
        },
        error: function (oErr) {
          console.error("Failed to load:", oErr && oErr.responseText);
        }
      });
    },

    // ── Compute today / upcoming lists for the sidebar ─────────────────────
    _rebuildSidebar: function (aAppointments) {
      var oCalModel = this.getView().getModel("calModel");
      var oToday    = startOfDay(new Date());
      var oTomorrow = new Date(oToday); oTomorrow.setDate(oTomorrow.getDate() + 1);
      var oWeekEnd  = new Date(oToday); oWeekEnd.setDate(oWeekEnd.getDate() + 8);

      var aToday    = [];
      var aUpcoming = [];

      aAppointments.forEach(function (a) {
        var oStart = a.startDate;
        if (!oStart) { return; }
        if (oStart >= oToday && oStart < oTomorrow) {
          aToday.push(a);
        } else if (oStart >= oTomorrow && oStart < oWeekEnd) {
          aUpcoming.push(a);
        }
      });

      var sortAsc = function (a, b) { return a.startDate - b.startDate; };
      aToday.sort(sortAsc);
      aUpcoming.sort(sortAsc);

      oCalModel.setProperty("/today",         aToday);
      oCalModel.setProperty("/upcoming",      aUpcoming);
      oCalModel.setProperty("/todayCount",    aToday.length);
      oCalModel.setProperty("/upcomingCount", aUpcoming.length);
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

    // ── Formatters for the sidebar lists ───────────────────────────────────
    fmtTime: function (oDate) {
      if (!oDate) { return ""; }
      return String(oDate.getHours()).padStart(2, "0") + ":" +
             String(oDate.getMinutes()).padStart(2, "0");
    },

    fmtDayShort: function (oDate) {
      if (!oDate) { return ""; }
      var aDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return aDays[oDate.getDay()] + " " +
             String(oDate.getDate()).padStart(2, "0") + "." +
             String(oDate.getMonth() + 1).padStart(2, "0");
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteHome");
    },

    onViewAllAppointments: function () {
      if (!this._sPersId) {
        MessageToast.show("Profile still loading — try again in a moment.");
        console.warn("onViewAllAppointments: _sPersId is empty");
        return;
      }
      console.log("Navigating to RouteMyAppointments with persId:", this._sPersId);
      this.getOwnerComponent().getRouter().navTo("RouteMyAppointments", {
        persId: this._sPersId
      });
    },

    // ── Calendar cell/date tracking ────────────────────────────────────────
    onCellPress: function (oEvent) {
      // Fired when user clicks an empty cell
      var oStart = oEvent.getParameter("startDate");
      if (oStart) { this._oSelectedDate = oStart; }
    },

    onStartDateChange: function (oEvent) {
      // Fired when user navigates to another period via the header
      var oCal = oEvent.getSource();
      this._oVisibleStart = oCal.getStartDate() || new Date();
    },

    onAppointmentCreateDrag: function (oEvent) {
      // Fired when user drags on empty slots to create an appointment
      var oStart = oEvent.getParameter("startDate");
      var oEnd   = oEvent.getParameter("endDate");
      this._sEditEntryId  = null;
      this._oSelectedDate = oStart;
      this._openDialog(function () {
        this._oDialog.setTitle("New Appointment");
        this._setDialogValues("", "", "Type01",
          oStart || new Date(),
          oEnd   || new Date((oStart || new Date()).getTime() + 3600000));
      }.bind(this));
    },

    onSidebarItemPress: function (oEvent) {
      // Reuse the calendar's edit flow when a sidebar card is pressed
      var oCtx = oEvent.getSource().getBindingContext("calModel");
      if (!oCtx) { return; }
      this._sEditEntryId = oCtx.getProperty("entryId");
      this._openDialog(function () {
        this._oDialog.setTitle("Edit Appointment");
        var sRawType = oCtx.getProperty("typeRaw") || "Type01";
        var sTypeKey = sRawType.charAt(0).toUpperCase() +
                       sRawType.slice(1).toLowerCase();
        this._setDialogValues(
          oCtx.getProperty("title"),
          oCtx.getProperty("description"),
          sTypeKey,
          oCtx.getProperty("startDate"),
          oCtx.getProperty("endDate")
        );
      }.bind(this));
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
        var sRawType = oCtx.getProperty("typeRaw") || "Type01";
        var sTypeKey = sRawType.charAt(0).toUpperCase() +
                       sRawType.slice(1).toLowerCase();
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

      // Prefer the cell the user just clicked; fall back to the visible
      // period start; fall back to now. This means "+ New Appointment"
      // opens on whatever day the user is actually looking at.
      var oBase = this._oSelectedDate || this._oVisibleStart || new Date();
      var oStart = new Date(oBase);
      var oNow   = new Date();

      // If the picked date is today but with no specific time (midnight),
      // snap to the current hour so the dialog is useful.
      if (oStart.getHours() === 0 && oStart.getMinutes() === 0 &&
          oStart.toDateString() === oNow.toDateString()) {
        oStart.setHours(oNow.getHours(), 0, 0, 0);
      }
      var oEnd = new Date(oStart.getTime() + 3600000);

      this._openDialog(function () {
        this._oDialog.setTitle("New Appointment");
        this._setDialogValues("", "", "Type01", oStart, oEnd);
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
          Type: sType,
          StartDate: that._toODataDate(oStart), EndDate: that._toODataDate(oEnd),
          StartTime: sST, EndTime: sET,
          CreatedOn: that._toODataDate(new Date())
        };
        that.getView().getModel().create("/Timesheets", oPayload, {
          success: function () {
            that._oDialog.close();
            that._loadAppointments();
            MessageToast.show("Appointment created — see 'All Appointments' for the full list.");
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
        Type: sType,
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
