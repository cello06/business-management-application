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
      this.getView().setModel(new JSONModel({
        PersId:          "",
        CourseId:        "",
        CourseName:      "",
        CourseDesc:      "",
        Category:        "",
        DurationHours:   0,
        TotalHours:      0,
        CompletedHours:  0,
        RemainingHours:  0,
        ProgressPercent: 0,
        ActiveCourse:    false,
        isEnrolled:      true    // false = show "not enrolled" state
      }), "detail");

      UIComponent.getRouterFor(this)
        .getRoute("RouteCourseDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      const oArgs      = oEvent.getParameter("arguments");
      this._sSectorId  = oArgs.sectorId;
      this._sPersId    = oArgs.persId;
      this._sCourseId  = oArgs.courseId;

      // persId "0" = not enrolled, load general course info only
      if (oArgs.persId === "0") {
        this._loadGeneralCourseInfo(oArgs.courseId);
      } else {
        this._loadCourseDetail(oArgs.persId, oArgs.courseId);
      }
    },

    // ── Load full employee-course detail (enrolled) ──────────────────
    _loadCourseDetail: function (sPersId, sCourseId) {
      const oModel       = this.getOwnerComponent().getModel();
      const oDetailModel = this.getView().getModel("detail");
      const sPath        = "/EmployeeCourses(PersId='" + sPersId + "',CourseId=" + sCourseId + ")";

      this.getView().setBusy(true);

      oModel.read(sPath, {
        success: function (oData) {
          const iTotal     = Number(oData.TotalHours     || 0);
          const iCompleted = Number(oData.CompletedHours || 0);
          const iRemaining = Math.max(0, iTotal - iCompleted);
          const fPercent   = iTotal > 0 ? (iCompleted / iTotal) * 100 : 0;

          let sProgressState, sProgressColor;
          if (fPercent >= 100) {
            sProgressState = "Success"; sProgressColor = "Good";
          } else if (fPercent >= 50) {
            sProgressState = "Warning"; sProgressColor = "Critical";
          } else {
            sProgressState = "Error";   sProgressColor = "Error";
          }

          oDetailModel.setData({
            PersId:          oData.PersId,
            CourseId:        oData.CourseId,
            CourseName:      oData.CourseName    || "",
            CourseDesc:      oData.CourseDesc     || "",
            Category:        oData.Category       || "",
            DurationHours:   oData.DurationHours  || 0,
            TotalHours:      iTotal,
            CompletedHours:  iCompleted,
            RemainingHours:  iRemaining,
            ProgressPercent: Number(fPercent.toFixed(1)),
            ActiveCourse:    !!oData.ActiveCourse,
            ProgressState:   sProgressState,
            ProgressColor:   sProgressColor,
            isEnrolled:      true
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

    // ── Load general course info only (not enrolled) ─────────────────
    _loadGeneralCourseInfo: function (sCourseId) {
      const oModel       = this.getOwnerComponent().getModel();
      const oDetailModel = this.getView().getModel("detail");

      this.getView().setBusy(true);

      oModel.read("/Courses(" + sCourseId + ")", {
        success: function (oData) {
          oDetailModel.setData({
            PersId:          "",
            CourseId:        oData.CourseId,
            CourseName:      oData.CourseName   || "",
            CourseDesc:      oData.CourseDesc    || "",
            Category:        oData.Category      || "",
            DurationHours:   oData.DurationHours || 0,
            TotalHours:      oData.DurationHours || 0,
            CompletedHours:  0,
            RemainingHours:  oData.DurationHours || 0,
            ProgressPercent: 0,
            ActiveCourse:    false,
            ProgressState:   "None",
            ProgressColor:   "Neutral",
            isEnrolled:      false   // ← triggers "not enrolled" UI in view
          });
          this.getView().setBusy(false);
        }.bind(this),
        error: function () {
          this.getView().setBusy(false);
          MessageBox.error("Course information could not be loaded.");
        }.bind(this)
      });
    },

    onNavBack: function () {
      const sPreviousHash = History.getInstance().getPreviousHash();

      // sectorId "0" = came from MyCourses flow
      if (this._sSectorId === "0") {
        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          UIComponent.getRouterFor(this).navTo("RouteMyCourses", {
            persId: this._sPersId === "0" ? "" : this._sPersId
          });
        }
        return;
      }

      // Came from EmployeeDetail flow
      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sSectorId,
        persId:   this._sPersId
      });
    }
  });
});