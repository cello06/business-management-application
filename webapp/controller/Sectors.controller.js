sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("hrproject.controller.Sectors", {

    onSectorPress: function (oEvent) {
      const oObj = oEvent.getSource().getBindingContext().getObject();
      this.getOwnerComponent().getRouter().navTo("RouteEmployee", {
        sectorId: String(oObj.SectorId)
      });
    },

    onNavBack: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteHome");
    }

  });
});