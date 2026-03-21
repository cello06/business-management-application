sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.AssignedProjectsDetail", {
    _oParentController: null,

    setParentController: function (oParentController) {
      this._oParentController = oParentController;
    },

    onRefreshPress: function () {
      if (this._oParentController && this._oParentController._loadProjects) {
        this._oParentController._loadProjects();
        MessageToast.show("Assigned projects refreshed.");
        return;
      }

      MessageToast.show("Parent controller not found.");
    },

    onProjectPress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      if (!oItem) {
        return;
      }

      var oContext = oItem.getBindingContext("projects");
      if (!oContext) {
        MessageToast.show("Project data not found.");
        return;
      }

      var oData = oContext.getObject();
      console.log("Selected assigned project:", oData);

      if (!this._oParentController) {
        MessageToast.show("Parent controller not found.");
        return;
      }

      if (!this._oParentController.onOpenProjectDetail) {
        MessageToast.show("Project detail navigation is not ready.");
        return;
      }

      this._oParentController.onOpenProjectDetail(oData);
    }
  });
});