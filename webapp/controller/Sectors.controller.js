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
      const sPrevHash = History.getInstance().getPreviousHash();
      if (sPrevHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
      }
    }

  });
});