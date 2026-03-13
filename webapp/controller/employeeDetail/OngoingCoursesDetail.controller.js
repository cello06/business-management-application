sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.OngoingCoursesDetail", {
    onAddCoursePress: function () {
      MessageToast.show("Add Course action will be added.");
    },

    onRefreshPress: function () {
      MessageToast.show("Ongoing courses refreshed.");
    },

    onCourseSelect: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) {
        return;
      }

      MessageToast.show("Selected: " + oItem.getTitle());
    }
  });
});