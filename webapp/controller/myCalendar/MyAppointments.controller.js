sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  var mTypeLabel = {
    "TYPE01": "Work", "TYPE02": "Available", "TYPE03": "Meeting",
    "TYPE05": "Personal", "TYPE07": "Social", "TYPE08": "Urgent", "TYPE09": "Reminder"
  };
  var mTypeState = {
    "TYPE01": "None", "TYPE02": "Success", "TYPE03": "Information",
    "TYPE05": "Warning", "TYPE07": "None", "TYPE08": "Error", "TYPE09": "Warning"
  };
  // Hex values align with sap.ui.unified.CalendarDayType (horizon theme)
  var mTypeColor = {
    "TYPE01": "#3C5CB0", "TYPE02": "#30913C", "TYPE03": "#009DA8",
    "TYPE05": "#E8762B", "TYPE07": "#D36FB4", "TYPE08": "#D20A0A",
    "TYPE09": "#8D5BC3"
  };

  function normKey(s) { return (s || "").toUpperCase(); }

  return Controller.extend("hrproject.controller.myCalendar.MyAppointments", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        all         : [],
        items       : [],
        count       : 0,
        scope       : "upcoming",
        typeFilter  : "",
        search      : "",
        kpi         : { upcomingCount: 0, weekCount: 0, pastCount: 0 }
      }), "appt");

      this.getOwnerComponent().getRouter()
        .getRoute("RouteMyAppointments")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      this._sPersId = oEvent.getParameter("arguments").persId;
      this._load();
    },

    // ── Data ───────────────────────────────────────────────────────────────
    _load: function () {
      var oOData = this.getView().getModel();
      var oVm    = this.getView().getModel("appt");
      var that   = this;

      oOData.read("/Timesheets", {
        urlParameters: { "$filter": "PersId eq '" + this._sPersId + "'" },
        success: function (oData) {
          var aItems = (oData.results || []).map(function (e) {
            var sKey = normKey(e.Type);
            return {
              entryId     : e.EntryId,
              title       : e.Title,
              description : e.Description || "",
              typeRaw     : sKey,
              typeLabel   : mTypeLabel[sKey] || "Other",
              typeState   : mTypeState[sKey] || "None",
              typeColor   : mTypeColor[sKey] || "#6A6D70",
              startDate   : that._toDate(e.StartDate, e.StartTime),
              endDate     : that._toDate(e.EndDate,   e.EndTime)
            };
          });
          oVm.setProperty("/all", aItems);
          that._computeKpi(aItems);
          that._applyFilter();
        },
        error: function (oErr) {
          console.error("Failed to load appointments:", oErr && oErr.responseText);
        }
      });
    },

    _computeKpi: function (aAll) {
      var oNow  = new Date();
      var oWeek = new Date(oNow); oWeek.setDate(oWeek.getDate() + 7);
      var iUp = 0, iWk = 0, iPast = 0;
      aAll.forEach(function (it) {
        if (it.endDate   <  oNow) { iPast++; return; }
        if (it.startDate <= oWeek) { iWk++; }
        iUp++;
      });
      this.getView().getModel("appt").setProperty("/kpi", {
        upcomingCount: iUp, weekCount: iWk, pastCount: iPast
      });
    },

    _applyFilter: function () {
      var oVm     = this.getView().getModel("appt");
      var aAll    = oVm.getProperty("/all") || [];
      var sScope  = oVm.getProperty("/scope");
      var sType   = oVm.getProperty("/typeFilter");
      var sSearch = (oVm.getProperty("/search") || "").toLowerCase();
      var oNow    = new Date();

      var aFiltered = aAll.filter(function (it) {
        if (sScope === "upcoming" && it.endDate   < oNow)  { return false; }
        if (sScope === "past"     && it.startDate >= oNow) { return false; }
        if (sType && it.typeRaw !== sType) { return false; }
        if (sSearch) {
          var sBlob = (it.title + " " + it.description).toLowerCase();
          if (sBlob.indexOf(sSearch) === -1) { return false; }
        }
        return true;
      });

      oVm.setProperty("/items", aFiltered);
      oVm.setProperty("/count", aFiltered.length);
    },

    // ── Filter handlers ────────────────────────────────────────────────────
    onScopeChange:      function ()        { this._applyFilter(); },
    onTypeFilterChange: function ()        { this._applyFilter(); },
    onSearch: function (oEvent) {
      this.getView().getModel("appt").setProperty(
        "/search", oEvent.getParameter("newValue") || ""
      );
      this._applyFilter();
    },

    onRefresh: function () {
      this._load();
      MessageToast.show("Refreshed.");
    },

    // ── Row press → open the detail page ──────────────────────────────────
    onRowPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("appt");
      if (!oCtx) { return; }
      var sEntryId = oCtx.getProperty("entryId");
      if (!sEntryId) { return; }
      this.getOwnerComponent().getRouter().navTo("RouteAppointmentDetail", {
        persId : this._sPersId,
        entryId: sEntryId
      });
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteMyCalendar", {
        persId: this._sPersId
      });
    },

    // ── Formatters ─────────────────────────────────────────────────────────
    fmtDateTime: function (oDate) {
      if (!oDate) { return ""; }
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return pad(oDate.getDate()) + "." + pad(oDate.getMonth() + 1) + "." +
             oDate.getFullYear() + "  " +
             pad(oDate.getHours()) + ":" + pad(oDate.getMinutes());
    },

    fmtDuration: function (oStart, oEnd) {
      if (!oStart || !oEnd) { return ""; }
      var iMin = Math.max(0, Math.round((oEnd - oStart) / 60000));
      if (iMin < 60) { return iMin + "m"; }
      var iHr  = Math.floor(iMin / 60);
      var iRem = iMin % 60;
      return iRem ? (iHr + "h " + iRem + "m") : (iHr + "h");
    },

    // ── OData DATS + TIMS → JS Date (shared with MyCalendar) ──────────────
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
    }

  });
});
