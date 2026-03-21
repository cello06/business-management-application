sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "sap/m/MessageBox",
  "sap/ui/core/UIComponent"
], function (Controller, JSONModel, History, MessageBox, UIComponent) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.CourseDetail", {

    onInit: function () {
      var oDetailModel = new JSONModel({
        PersId: "",
        CourseId: "",
        CourseName: "",
        CourseDesc: "",
        Category: "",
        DurationHours: 0,
        TotalHours: 0,
        CompletedHours: 0,
        RemainingHours: 0,
        ProgressPercent: 0,
        ActiveCourse: false
      });

      this.getView().setModel(oDetailModel, "detail");

      UIComponent.getRouterFor(this)
        .getRoute("RouteCourseDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      this._sSectorId = oArgs.sectorId;
      this._sPersId = oArgs.persId;
      this._loadCourseDetail(oArgs.persId, oArgs.courseId);
    },

    _loadCourseDetail: function (sPersId, sCourseId) {
      var oModel = this.getOwnerComponent().getModel();
      var oDetailModel = this.getView().getModel("detail");
      var sPath = "/EmployeeCourses(PersId='" + sPersId + "',CourseId=" + sCourseId + ")";

      this.getView().setBusy(true);

      oModel.read(sPath, {
        success: function (oData) {
          var iTotal = Number(oData.TotalHours || 0);
          var iCompleted = Number(oData.CompletedHours || 0);
          var iRemaining = Math.max(0, iTotal - iCompleted);
          var fPercent = iTotal > 0 ? (iCompleted / iTotal) * 100 : 0;

          var sProgressState = "Error";
          var sProgressColor = "Error";

          if (fPercent >= 100) {
            sProgressState = "Success";
            sProgressColor = "Good";
          } else if (fPercent >= 50) {
            sProgressState = "Warning";
            sProgressColor = "Critical";
          } else {
            sProgressState = "Error";
            sProgressColor = "Error";
          }

          oDetailModel.setData({
            PersId: oData.PersId,
            CourseId: oData.CourseId,
            CourseName: oData.CourseName || "",
            CourseDesc: oData.CourseDesc || "",
            Category: oData.Category || "",
            DurationHours: oData.DurationHours || 0,
            TotalHours: iTotal,
            CompletedHours: iCompleted,
            RemainingHours: iRemaining,
            ProgressPercent: Number(fPercent.toFixed(1)),
            ActiveCourse: !!oData.ActiveCourse,
            ProgressState: sProgressState,
            ProgressColor: sProgressColor
          });

          this.getView().setBusy(false);
        }.bind(this),

        error: function (oError) {
          this.getView().setBusy(false);
          console.error("Course detail read error:", oError);
          MessageBox.error("Course detail could not be loaded.");
        }.bind(this)
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sSectorId,
        persId: this._sPersId
      });
    }
  });
});