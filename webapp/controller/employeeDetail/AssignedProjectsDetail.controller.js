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

    onAssignProjectPress: function () {
      if (!this._oParentController) {
        MessageToast.show("Parent controller not found.");
        return;
      }

      this._oParentController.onAssignProjectPress();
    },

    onRefreshPress: function () {
      if (!this._oParentController) {
        MessageToast.show("Parent controller not found.");
        return;
      }

      this._oParentController._loadProjects();
      MessageToast.show("Assigned projects refreshed.");
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

      if (!this._oParentController) {
        MessageToast.show("Parent controller not found.");
        return;
      }

      this._oParentController.onOpenProjectDetail(oData);
    }
  });
});