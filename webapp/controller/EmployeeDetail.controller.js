sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "hrproject/model/formatter",
  "sap/m/MessageToast",
], function (Controller, UIComponent, History, JSONModel, Filter, FilterOperator, formatter, MessageToast) {
  "use strict";

  return Controller.extend("hrproject.controller.EmployeeDetail", {
    formatter: formatter,

    onInit: function () {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteEmployeeDetail").attachPatternMatched(this._onRouteMatched, this);

      this.getView().setModel(new JSONModel({
        ongoing: [],
        completed: []
      }), "courses");
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      var sPersId = oArgs.persId;

      this._sSectorId = oArgs.sectorId;
      this._sPersId = sPersId;

      this.getView().bindElement({
        path: "/Employees('" + sPersId + "')"
      });

      this._loadCourses(sPersId);
    },

    _loadCourses: function (sPersId) {
      var oModel = this.getView().getModel();
      var that = this;

      oModel.read("/EmployeeCourses", {
        filters: [
          new Filter("PersId", FilterOperator.EQ, sPersId)
        ],
        success: function (oData) {
          var aEmployeeCourses = oData.results || [];

          if (!aEmployeeCourses.length) {
            that.getView().getModel("courses").setData({
              ongoing: [],
              completed: []
            });
            return;
          }

          that._loadCourseDetails(aEmployeeCourses);
        },
        error: function () {
          that.getView().getModel("courses").setData({
            ongoing: [],
            completed: []
          });
        }
      });
    },

    _loadCourseDetails: function (aEmployeeCourses) {
      var oModel = this.getView().getModel();
      var that = this;

      var aCourseFilters = aEmployeeCourses.map(function (oItem) {
        return new Filter("CourseId", FilterOperator.EQ, oItem.CourseId);
      });

      oModel.read("/Courses", {
        filters: [
          new Filter({
            filters: aCourseFilters,
            and: false
          })
        ],
        success: function (oData) {
          var aCourses = oData.results || [];
          var mCoursesById = {};

          aCourses.forEach(function (oCourse) {
            mCoursesById[oCourse.CourseId] = oCourse;
          });

          var aOngoing = [];
          var aCompleted = [];

          aEmployeeCourses.forEach(function (oEmpCourse) {
            var oCourseDetail = mCoursesById[oEmpCourse.CourseId] || {};

            var oMergedCourse = {
              CourseId: oEmpCourse.CourseId,
              CourseName: oCourseDetail.CourseName || ("Course " + oEmpCourse.CourseId),
              ActiveCourse: oEmpCourse.ActiveCourse
            };

            if (oEmpCourse.ActiveCourse === true) {
              aOngoing.push(oMergedCourse);
            } else {
              aCompleted.push(oMergedCourse);
            }
          });

          that.getView().getModel("courses").setData({
            ongoing: aOngoing,
            completed: aCompleted
          });
        },
        error: function () {
          var aOngoing = [];
          var aCompleted = [];

          aEmployeeCourses.forEach(function (oEmpCourse) {
            var oFallbackCourse = {
              CourseId: oEmpCourse.CourseId,
              CourseName: "Course " + oEmpCourse.CourseId,
              ActiveCourse: oEmpCourse.ActiveCourse
            };

            if (oEmpCourse.ActiveCourse === true) {
              aOngoing.push(oFallbackCourse);
            } else {
              aCompleted.push(oFallbackCourse);
            }
          });

          that.getView().getModel("courses").setData({
            ongoing: aOngoing,
            completed: aCompleted
          });
        }
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteEmployee", {
        sectorId: this._sSectorId
      });
    },
    onAssignPress: function () {
      MessageToast.show("Assign page daha sonra eklenecek.");
    },
  });
});