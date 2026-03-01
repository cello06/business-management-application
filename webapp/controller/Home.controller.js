sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("hrproject.controller.Home", {

    onInit: function () {
      // Home için küçük bir JSONModel
      const oHomeModel = new JSONModel({ sectorCount: 0 });
      this.getView().setModel(oHomeModel, "home");

      this._loadSectorCount();
    },

    _loadSectorCount: function () {
      const oModel = this.getOwnerComponent().getModel(); // default OData model
      const oHomeModel = this.getView().getModel("home");

      oModel.read("/Sectors/$count", {
        success: function (oData) {
          // V2 count genelde string/plain text döner; bazen oData direkt sayı gelir
          const s = (typeof oData === "string") ? oData : (oData && oData.toString ? oData.toString() : "0");
          const iCount = parseInt(s, 10) || 0;
          oHomeModel.setProperty("/sectorCount", iCount);
        },
        error: function () {
          // hata olursa 0 kalsın
          oHomeModel.setProperty("/sectorCount", 0);
        }
      });
    },

    onOpenSectors: function () {
      this.getOwnerComponent().getRouter().navTo("RouteSectors");
    },

    onCreateDepartment: function () {
      sap.m.MessageToast.show("Create Department - next step!");
    },

    onEmployeeRegistration: function () {
      sap.m.MessageToast.show("Employee Registration - next step!");
    },

    onCourseRegistration: function () {
      sap.m.MessageToast.show("Course Registration - next step!");
    }

  });
});