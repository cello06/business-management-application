sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.OngoingCoursesDetail", {
    _oParentController: null,

    setParentController: function (oParentController) {
      this._oParentController = oParentController;
    },

    onAddCoursePress: function () {
      MessageToast.show("Add Course action will be added.");
    },

    onRefreshPress: function () {
      MessageToast.show("Ongoing courses refreshed.");
    },

    onCoursePress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      if (!oItem) {
        return;
      }

      var oContext = oItem.getBindingContext("courses");
      if (!oContext) {
        MessageToast.show("Course data not found.");
        return;
      }

      var oData = oContext.getObject();
      console.log("Selected ongoing course:", oData);

      if (!this._oParentController) {
        MessageToast.show("Parent controller not found.");
        return;
      }

      this._oParentController.onOpenCourseDetail(oData);
    }
  });
});