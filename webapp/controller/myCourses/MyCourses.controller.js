sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast"
], function (Controller, JSONModel, History, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.myCourses.MyCourses", {

    onInit: function () {
      const oModel = new JSONModel({
        ongoingCount:  0,
        finishedCount: 0,
        allCount:      0
      });
      this.getView().setModel(oModel, "myCourses");

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteMyCourses")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      this._sPersId = oEvent.getParameter("arguments").persId;
      this._loadCounts();
    },

    _loadCounts: function () {
      const oODataModel = this.getOwnerComponent().getModel();
      const oViewModel  = this.getView().getModel("myCourses");
      const sPersId     = this._sPersId;

      // Ongoing: ActiveCourse = true
      oODataModel.read("/EmployeeCourses/$count", {
        urlParameters: {
          "$filter": "PersId eq '" + sPersId + "' and ActiveCourse eq true"
        },
        success: function (oData) {
          oViewModel.setProperty("/ongoingCount", parseInt(oData, 10) || 0);
        }
      });

      // Finished: ActiveCourse = false
      oODataModel.read("/EmployeeCourses/$count", {
        urlParameters: {
          "$filter": "PersId eq '" + sPersId + "' and ActiveCourse eq false"
        },
        success: function (oData) {
          oViewModel.setProperty("/finishedCount", parseInt(oData, 10) || 0);
        }
      });

      // All courses total
      oODataModel.read("/Courses/$count", {
        success: function (oData) {
          oViewModel.setProperty("/allCount", parseInt(oData, 10) || 0);
        }
      });
    },

    onTilePress: function (oEvent) {
      const sType = oEvent.getSource().data("type");
      this.getOwnerComponent().getRouter().navTo("RouteCourseList", {
        type:   sType,
        persId: this._sPersId
      });
    },

    onCertificatesPress: function () {
      MessageToast.show("Certificates — coming soon.");
    },

    onNavBack: function () {
      const sPreviousHash = History.getInstance().getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
      }
    }
  });
});