sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (
  Controller,
  UIComponent,
  JSONModel,
  Filter,
  FilterOperator,
  MessageToast,
  MessageBox
) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.AssignCourse", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        sectorId: "",
        persId: "",
        availableCourses: [],
        assignedCourses: [],
        allAvailableCourses: [],
        originalAssignedCourses: []
      }), "assign");

      UIComponent.getRouterFor(this)
        .getRoute("RouteAssignCourse")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      var sSectorId = oArgs.sectorId;
      var sPersId = oArgs.persId;
      var oAssignModel = this.getView().getModel("assign");

      oAssignModel.setProperty("/sectorId", sSectorId);
      oAssignModel.setProperty("/persId", sPersId);

      this._loadData(sPersId);
    },

    _loadData: function (sPersId) {
      var oModel = this.getView().getModel();
      var oAssignModel = this.getView().getModel("assign");
      var that = this;

      oAssignModel.setProperty("/availableCourses", []);
      oAssignModel.setProperty("/assignedCourses", []);
      oAssignModel.setProperty("/allAvailableCourses", []);
      oAssignModel.setProperty("/originalAssignedCourses", []);

      oModel.read("/Courses", {
        success: function (oCoursesData) {
          var aAllCourses = (oCoursesData.results || []).map(function (oCourse) {
            return {
              CourseId: oCourse.CourseId,
              CourseName: oCourse.CourseName || ("Course " + oCourse.CourseId),
              Category: oCourse.CourseCategory || "",
              DurationHours: oCourse.DurationHours || 0,
              CourseDesc: oCourse.CourseDesc || ""
            };
          });

          oModel.read("/EmployeeCourses", {
            filters: [
              new Filter("PersId", FilterOperator.EQ, sPersId)
            ],
            success: function (oEmpCoursesData) {
              var aEmpCourses = oEmpCoursesData.results || [];
              var aCourseFilters = aEmpCourses.map(function (oItem) {
                return new Filter("CourseId", FilterOperator.EQ, oItem.CourseId);
              });

              if (!aEmpCourses.length) {
                oAssignModel.setProperty("/availableCourses", aAllCourses);
                oAssignModel.setProperty("/allAvailableCourses", JSON.parse(JSON.stringify(aAllCourses)));
                oAssignModel.setProperty("/assignedCourses", []);
                oAssignModel.setProperty("/originalAssignedCourses", []);
                return;
              }

              oModel.read("/Courses", {
                filters: [
                  new Filter({
                    filters: aCourseFilters,
                    and: false
                  })
                ],
                success: function (oAssignedCourseDetails) {
                  var aAssignedCourseDetails = oAssignedCourseDetails.results || [];
                  var mCoursesById = {};

                  aAssignedCourseDetails.forEach(function (oCourse) {
                    mCoursesById[oCourse.CourseId] = oCourse;
                  });

                  var aAssigned = aEmpCourses.map(function (oEmpCourse) {
                    var oCourse = mCoursesById[oEmpCourse.CourseId] || {};

                    return {
                      PersId: oEmpCourse.PersId,
                      CourseId: oEmpCourse.CourseId,
                      CourseName: oCourse.CourseName || ("Course " + oEmpCourse.CourseId),
                      Category: oCourse.CourseCategory || "",
                      DurationHours: oCourse.DurationHours || 0,
                      CourseDesc: oCourse.CourseDesc || "",
                      CompletedHours: oEmpCourse.CompletedHours || 0,
                      TotalHours: oEmpCourse.TotalHours || oCourse.DurationHours || 0,
                      ActiveCourse: oEmpCourse.ActiveCourse
                    };
                  });

                  var aAssignedIds = aAssigned.map(function (oItem) {
                    return oItem.CourseId;
                  });

                  var aAvailable = aAllCourses.filter(function (oCourse) {
                    return aAssignedIds.indexOf(oCourse.CourseId) === -1;
                  });

                  oAssignModel.setProperty("/availableCourses", aAvailable);
                  oAssignModel.setProperty("/allAvailableCourses", JSON.parse(JSON.stringify(aAvailable)));
                  oAssignModel.setProperty("/assignedCourses", aAssigned);
                  oAssignModel.setProperty("/originalAssignedCourses", JSON.parse(JSON.stringify(aAssigned)));
                },
                error: function () {
                  MessageBox.error("Assigned course details could not be loaded.");
                }
              });
            },
            error: function () {
              MessageBox.error("Employee assigned courses could not be loaded.");
            }
          });
        },
        error: function () {
          MessageBox.error("Available courses could not be loaded.");
        }
      });
    },

    onAssignSelected: function () {
      var oAssignModel = this.getView().getModel("assign");
      var oAvailableTable = this.byId("availableCoursesTable");
      var aSelectedContexts = oAvailableTable.getSelectedContexts("assign");

      if (!aSelectedContexts.length) {
        MessageToast.show("Please select at least one available course.");
        return;
      }

      var aAvailable = oAssignModel.getProperty("/availableCourses");
      var aAssigned = oAssignModel.getProperty("/assignedCourses");
      var sPersId = oAssignModel.getProperty("/persId");

      var aSelectedCourses = aSelectedContexts.map(function (oContext) {
        return oContext.getObject();
      });

      aSelectedCourses.forEach(function (oCourse) {
        aAssigned.push({
          PersId: sPersId,
          CourseId: oCourse.CourseId,
          CourseName: oCourse.CourseName,
          Category: oCourse.Category,
          DurationHours: oCourse.DurationHours,
          CourseDesc: oCourse.CourseDesc,
          CompletedHours: 0,
          TotalHours: oCourse.DurationHours || 0,
          ActiveCourse: true
        });
      });

      aAvailable = aAvailable.filter(function (oAvailableCourse) {
        return !aSelectedCourses.some(function (oSelectedCourse) {
          return oSelectedCourse.CourseId === oAvailableCourse.CourseId;
        });
      });

      oAssignModel.setProperty("/availableCourses", aAvailable);
      oAssignModel.setProperty("/assignedCourses", aAssigned);

      oAvailableTable.removeSelections(true);
    },

    onRemoveSelected: function () {
      var oAssignModel = this.getView().getModel("assign");
      var oAssignedTable = this.byId("assignedCoursesTable");
      var aSelectedContexts = oAssignedTable.getSelectedContexts("assign");

      if (!aSelectedContexts.length) {
        MessageToast.show("Please select at least one assigned course.");
        return;
      }

      var aAvailable = oAssignModel.getProperty("/availableCourses");
      var aAssigned = oAssignModel.getProperty("/assignedCourses");

      var aSelectedCourses = aSelectedContexts.map(function (oContext) {
        return oContext.getObject();
      });

      aSelectedCourses.forEach(function (oCourse) {
        aAvailable.push({
          CourseId: oCourse.CourseId,
          CourseName: oCourse.CourseName,
          Category: oCourse.Category,
          DurationHours: oCourse.DurationHours,
          CourseDesc: oCourse.CourseDesc
        });
      });

      aAssigned = aAssigned.filter(function (oAssignedCourse) {
        return !aSelectedCourses.some(function (oSelectedCourse) {
          return oSelectedCourse.CourseId === oAssignedCourse.CourseId;
        });
      });

      aAvailable.sort(function (a, b) {
        return String(a.CourseId).localeCompare(String(b.CourseId));
      });

      oAssignModel.setProperty("/availableCourses", aAvailable);
      oAssignModel.setProperty("/assignedCourses", aAssigned);

      oAssignedTable.removeSelections(true);
    },

    onSearchAvailableCourses: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase();
      var oAssignModel = this.getView().getModel("assign");
      var aBackup = oAssignModel.getProperty("/allAvailableCourses") || [];
      var aAssigned = oAssignModel.getProperty("/assignedCourses") || [];

      var aAssignedIds = aAssigned.map(function (oItem) {
        return oItem.CourseId;
      });

      var aFiltered = aBackup.filter(function (oCourse) {
        var bNotAssigned = aAssignedIds.indexOf(oCourse.CourseId) === -1;
        var bMatch = !sValue ||
          String(oCourse.CourseId).toLowerCase().indexOf(sValue) > -1 ||
          String(oCourse.CourseName).toLowerCase().indexOf(sValue) > -1 ||
          String(oCourse.Category).toLowerCase().indexOf(sValue) > -1;

        return bNotAssigned && bMatch;
      });

      oAssignModel.setProperty("/availableCourses", aFiltered);
    },

    onSave: function () {
      var oModel = this.getView().getModel();
      var oAssignModel = this.getView().getModel("assign");
      var sPersId = oAssignModel.getProperty("/persId");
      var aCurrentAssigned = oAssignModel.getProperty("/assignedCourses") || [];
      var aOriginalAssigned = oAssignModel.getProperty("/originalAssignedCourses") || [];
      var that = this;

      var aCurrentIds = aCurrentAssigned.map(function (oItem) {
        return oItem.CourseId;
      });

      var aOriginalIds = aOriginalAssigned.map(function (oItem) {
        return oItem.CourseId;
      });

      var aToCreate = aCurrentAssigned.filter(function (oItem) {
        return aOriginalIds.indexOf(oItem.CourseId) === -1;
      });

      var aToDelete = aOriginalAssigned.filter(function (oItem) {
        return aCurrentIds.indexOf(oItem.CourseId) === -1;
      });

      if (!aToCreate.length && !aToDelete.length) {
        MessageToast.show("No changes to save.");
        return;
      }

      var iPending = 0;
      var bError = false;

      function fnDone() {
        if (iPending === 0 && !bError) {
          MessageToast.show("Course assignments saved successfully.");
          that.onNavBack();
        }
      }

      aToCreate.forEach(function (oItem) {
        iPending++;

        oModel.create("/EmployeeCourses", {
          PersId: sPersId,
          CourseId: oItem.CourseId,
          CompletedHours: 0,
          TotalHours: oItem.TotalHours || 0,
          ActiveCourse: true
        }, {
          success: function () {
            iPending--;
            fnDone();
          },
          error: function () {
            bError = true;
            MessageBox.error("A course could not be assigned.");
          }
        });
      });

      aToDelete.forEach(function (oItem) {
        iPending++;

        var sPath = oModel.createKey("/EmployeeCourses", {
          PersId: sPersId,
          CourseId: oItem.CourseId
        });

        oModel.remove(sPath, {
          success: function () {
            iPending--;
            fnDone();
          },
          error: function () {
            bError = true;
            MessageBox.error("A course could not be removed.");
          }
        });
      });
    },

    onNavBack: function () {
      var oAssignModel = this.getView().getModel("assign");

      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: String(oAssignModel.getProperty("/sectorId")),
        persId: String(oAssignModel.getProperty("/persId"))
      });
    }
  });
});