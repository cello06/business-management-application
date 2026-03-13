sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/mvc/XMLView",
  "hrproject/model/formatter",
  "sap/m/MessageToast"
], function (
  Controller,
  UIComponent,
  JSONModel,
  Filter,
  FilterOperator,
  XMLView,
  formatter,
  MessageToast
) {
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

      this.getView().setModel(new JSONModel({
        items: []
      }), "projects");

      this.getView().setModel(new JSONModel({
        nodes: [
          { key: "ongoing", title: "Ongoing Courses", icon: "sap-icon://learning-assistant" },
          { key: "completed", title: "Completed Courses", icon: "sap-icon://complete" },
          { key: "projects", title: "Assigned Projects", icon: "sap-icon://project-definition-triangle-2" }
        ]
      }), "nav");
    },

    onTreeSelectionChange: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) {
        return;
      }

      var oContext = oItem.getBindingContext("nav");
      if (!oContext) {
        return;
      }

      var sKey = oContext.getProperty("key");
      this._loadDetailView(sKey);
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
      this._loadProjects();
      this._clearDetailHost();
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
          var aOngoing = [];
          var aCompleted = [];

          aCourses.forEach(function (oCourse) {
            mCoursesById[oCourse.CourseId] = oCourse;
          });

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

    _loadProjects: function () {
      this.getView().getModel("projects").setData({
        items: [
          {
            ProjectId: "PRJ-1001",
            ProjectName: "HR Transformation",
            Status: "In Progress",
            Owner: "PMO Office"
          },
          {
            ProjectId: "PRJ-1002",
            ProjectName: "Learning Portal Upgrade",
            Status: "Planned",
            Owner: "IT Team"
          }
        ]
      });
    },

    _clearDetailHost: function () {
      var oHost = this.byId("detailHost");
      oHost.removeAllItems();

      oHost.addItem(new sap.m.MessageStrip({
        text: "Select a category from the left side.",
        type: "Information",
        showIcon: true
      }));
    },

    _loadDetailView: function (sKey) {
      var oHost = this.byId("detailHost");
      var sViewName = "";

      if (sKey === "ongoing") {
        sViewName = "hrproject.view.employeeDetail.OngoingCoursesDetail";
      } else if (sKey === "completed") {
        sViewName = "hrproject.view.employeeDetail.CompletedCoursesDetail";
      } else if (sKey === "projects") {
        sViewName = "hrproject.view.employeeDetail.AssignedProjectsDetail";
      }

      if (!sViewName) {
        return;
      }

      oHost.removeAllItems();

      XMLView.create({
        viewName: sViewName
      }).then(function (oDetailView) {
        oDetailView.setModel(this.getView().getModel());
        oDetailView.setModel(this.getView().getModel("courses"), "courses");
        oDetailView.setModel(this.getView().getModel("projects"), "projects");
        oDetailView.setModel(this.getView().getModel("nav"), "nav");

        oHost.addItem(oDetailView);
      }.bind(this));
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteEmployee", {
        sectorId: this._sSectorId
      });
    },

    onAssignPress: function () {
      MessageToast.show("Assign page daha sonra eklenecek.");
    }
  });
});