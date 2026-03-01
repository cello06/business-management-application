sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, History, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("hrproject.controller.Employee", {

    onInit: function () {
      this.getOwnerComponent().getRouter()
        .getRoute("RouteEmployee")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      const sectorId = oEvent.getParameter("arguments").sectorId;

      const oList = this.byId("employeeList");
      const oBinding = oList.getBinding("items");

      // Employee entity içinde SectorId alanı varsa:
      oBinding.filter([
        new Filter("SectorId", FilterOperator.EQ, Number(sectorId))
      ]);
    },

    onNavBack: function () {
      const sPrevHash = History.getInstance().getPreviousHash();
      if (sPrevHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
      }
    }

  });
});