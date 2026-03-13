sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.AssignedProjectsDetail", {
    onAssignProjectPress: function () {
      MessageToast.show("Assign project action will be added.");
    },

    onViewTimelinePress: function () {
      MessageToast.show("Project timeline page will be added.");
    },

    onProjectSelect: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) {
        return;
      }

      MessageToast.show("Project selected: " + oItem.getTitle());
    }
  });
});