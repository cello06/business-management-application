sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.CompletedCoursesDetail", {
    onExportPress: function () {
      MessageToast.show("Export for completed courses will be added.");
    },

    onCourseSelect: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) {
        return;
      }

      MessageToast.show("Completed course selected: " + oItem.getTitle());
    }
  });
});