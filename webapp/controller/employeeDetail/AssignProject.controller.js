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

  return Controller.extend("hrproject.controller.employeeDetail.AssignProject", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        sectorId: "",
        persId: "",
        availableProjects: [],
        assignedProjects: [],
        allAvailableProjects: [],
        originalAssignedProjects: []
      }), "assignProject");

      UIComponent.getRouterFor(this)
        .getRoute("RouteAssignProject")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      var sSectorId = oArgs.sectorId;
      var sPersId = oArgs.persId;
      var oAssignModel = this.getView().getModel("assignProject");

      oAssignModel.setProperty("/sectorId", sSectorId);
      oAssignModel.setProperty("/persId", sPersId);

      this._loadData(sPersId);
    },

    _loadData: function (sPersId) {
      var oModel = this.getView().getModel();
      var oAssignModel = this.getView().getModel("assignProject");

      oAssignModel.setProperty("/availableProjects", []);
      oAssignModel.setProperty("/assignedProjects", []);
      oAssignModel.setProperty("/allAvailableProjects", []);
      oAssignModel.setProperty("/originalAssignedProjects", []);

      oModel.read("/Projects", {
        success: function (oProjectsData) {
          var aAllProjects = (oProjectsData.results || []).map(function (oProject) {
            return {
              ProjectId: oProject.ProjectId,
              ProjectName: oProject.ProjectName || ("Project " + oProject.ProjectId),
              ProjectDesc: oProject.ProjectDesc || "",
              ProjectCategory: oProject.ProjectCategory || "",
              Status: oProject.Status || "",
              Priority: oProject.Priority || "",
              StartDate: oProject.StartDate,
              EndDate: oProject.EndDate
            };
          });

          oModel.read("/PersonProjects", {
            filters: [
              new Filter("PersId", FilterOperator.EQ, sPersId)
            ],
            success: function (oEmpProjectsData) {
              var aPersonProjects = oEmpProjectsData.results || [];
              var mProjectsById = {};

              aAllProjects.forEach(function (oProject) {
                mProjectsById[oProject.ProjectId] = oProject;
              });

              var aAssigned = aPersonProjects.map(function (oItem) {
                var oProject = mProjectsById[oItem.ProjectId] || {};

                return {
                  PersId: oItem.PersId,
                  ProjectId: oItem.ProjectId,
                  ProjectName: oProject.ProjectName || ("Project " + oItem.ProjectId),
                  ProjectDesc: oProject.ProjectDesc || "",
                  ProjectCategory: oProject.ProjectCategory || "",
                  Status: oProject.Status || "",
                  Priority: oProject.Priority || "",
                  Role: oItem.RoleInProject || "",
                  AssignedDate: oItem.AssignedDate,
                  ActiveProject: oItem.ActiveProject,
                  TotalHours: oItem.HoursAllocated || 0,
                  HoursSpent: oItem.HoursSpent || 0
                };
              });

              var aAssignedIds = aAssigned.map(function (oItem) {
                return oItem.ProjectId;
              });

              var aAvailable = aAllProjects.filter(function (oProject) {
                return aAssignedIds.indexOf(oProject.ProjectId) === -1;
              }).map(function (oProject) {
                return {
                  ProjectId: oProject.ProjectId,
                  ProjectName: oProject.ProjectName,
                  ProjectDesc: oProject.ProjectDesc,
                  ProjectCategory: oProject.ProjectCategory,
                  Status: oProject.Status,
                  Priority: oProject.Priority,
                  StartDate: oProject.StartDate,
                  EndDate: oProject.EndDate,
                  Role: "",
                  TotalHours: 0,
                  HoursSpent: 0
                };
              });

              oAssignModel.setProperty("/availableProjects", aAvailable);
              oAssignModel.setProperty("/allAvailableProjects", JSON.parse(JSON.stringify(aAvailable)));
              oAssignModel.setProperty("/assignedProjects", aAssigned);
              oAssignModel.setProperty("/originalAssignedProjects", JSON.parse(JSON.stringify(aAssigned)));
            },
            error: function () {
              MessageBox.error("Assigned projects could not be loaded.");
            }
          });
        },
        error: function () {
          MessageBox.error("Available projects could not be loaded.");
        }
      });
    },

    onAssignSelected: function () {
      var oAssignModel = this.getView().getModel("assignProject");
      var oAvailableTable = this.byId("availableProjectsTable");
      var aSelectedContexts = oAvailableTable.getSelectedContexts("assignProject");

      if (!aSelectedContexts.length) {
        MessageToast.show("Please select at least one available project.");
        return;
      }

      var aAvailable = oAssignModel.getProperty("/availableProjects");
      var aAssigned = oAssignModel.getProperty("/assignedProjects");
      var sPersId = oAssignModel.getProperty("/persId");

      var aSelectedProjects = aSelectedContexts.map(function (oContext) {
        return oContext.getObject();
      });

      aSelectedProjects.forEach(function (oProject) {
        aAssigned.push({
          PersId: sPersId,
          ProjectId: oProject.ProjectId,
          ProjectName: oProject.ProjectName,
          ProjectDesc: oProject.ProjectDesc,
          ProjectCategory: oProject.ProjectCategory,
          Status: oProject.Status,
          Priority: oProject.Priority,
          Role: "",
          AssignedDate: null,
          ActiveProject: true,
          TotalHours: 0,
          HoursSpent: 0
        });
      });

      aAvailable = aAvailable.filter(function (oAvailableProject) {
        return !aSelectedProjects.some(function (oSelectedProject) {
          return oSelectedProject.ProjectId === oAvailableProject.ProjectId;
        });
      });

      oAssignModel.setProperty("/availableProjects", aAvailable);
      oAssignModel.setProperty("/assignedProjects", aAssigned);

      oAvailableTable.removeSelections(true);
    },

    onRemoveSelected: function () {
      var oAssignModel = this.getView().getModel("assignProject");
      var oAssignedTable = this.byId("assignedProjectsTable");
      var aSelectedContexts = oAssignedTable.getSelectedContexts("assignProject");

      if (!aSelectedContexts.length) {
        MessageToast.show("Please select at least one assigned project.");
        return;
      }

      var aAvailable = oAssignModel.getProperty("/availableProjects");
      var aAssigned = oAssignModel.getProperty("/assignedProjects");

      var aSelectedProjects = aSelectedContexts.map(function (oContext) {
        return oContext.getObject();
      });

      aSelectedProjects.forEach(function (oProject) {
        aAvailable.push({
          ProjectId: oProject.ProjectId,
          ProjectName: oProject.ProjectName,
          ProjectDesc: oProject.ProjectDesc,
          ProjectCategory: oProject.ProjectCategory,
          Status: oProject.Status,
          Priority: oProject.Priority,
          StartDate: oProject.StartDate,
          EndDate: oProject.EndDate,
          Role: "",
          TotalHours: 0,
          HoursSpent: 0
        });
      });

      aAssigned = aAssigned.filter(function (oAssignedProject) {
        return !aSelectedProjects.some(function (oSelectedProject) {
          return oSelectedProject.ProjectId === oAssignedProject.ProjectId;
        });
      });

      aAvailable.sort(function (a, b) {
        return String(a.ProjectId).localeCompare(String(b.ProjectId));
      });

      oAssignModel.setProperty("/availableProjects", aAvailable);
      oAssignModel.setProperty("/assignedProjects", aAssigned);

      oAssignedTable.removeSelections(true);
    },

    onSearchAvailableProjects: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase();
      var oAssignModel = this.getView().getModel("assignProject");
      var aBackup = oAssignModel.getProperty("/allAvailableProjects") || [];
      var aAssigned = oAssignModel.getProperty("/assignedProjects") || [];

      var aAssignedIds = aAssigned.map(function (oItem) {
        return oItem.ProjectId;
      });

      var aFiltered = aBackup.filter(function (oProject) {
        var bNotAssigned = aAssignedIds.indexOf(oProject.ProjectId) === -1;
        var bMatch = !sValue ||
          String(oProject.ProjectId).toLowerCase().indexOf(sValue) > -1 ||
          String(oProject.ProjectName).toLowerCase().indexOf(sValue) > -1 ||
          String(oProject.ProjectCategory).toLowerCase().indexOf(sValue) > -1 ||
          String(oProject.Status).toLowerCase().indexOf(sValue) > -1 ||
          String(oProject.Priority).toLowerCase().indexOf(sValue) > -1;

        return bNotAssigned && bMatch;
      });

      oAssignModel.setProperty("/availableProjects", aFiltered);
    },

    onSave: function () {
      var oModel = this.getView().getModel();
      var oAssignModel = this.getView().getModel("assignProject");
      var sPersId = oAssignModel.getProperty("/persId");
      var aCurrentAssigned = oAssignModel.getProperty("/assignedProjects") || [];
      var aOriginalAssigned = oAssignModel.getProperty("/originalAssignedProjects") || [];
      var that = this;

      var aCurrentIds = aCurrentAssigned.map(function (oItem) {
        return oItem.ProjectId;
      });

      var aOriginalIds = aOriginalAssigned.map(function (oItem) {
        return oItem.ProjectId;
      });

      var aToCreate = aCurrentAssigned.filter(function (oItem) {
        return aOriginalIds.indexOf(oItem.ProjectId) === -1;
      });

      var aToDelete = aOriginalAssigned.filter(function (oItem) {
        return aCurrentIds.indexOf(oItem.ProjectId) === -1;
      });

      if (!aToCreate.length && !aToDelete.length) {
        MessageToast.show("No changes to save.");
        return;
      }

      var iPending = 0;
      var bError = false;

      function fnDone() {
        if (iPending === 0 && !bError) {
          MessageToast.show("Project assignments saved successfully.");
          that.onNavBack();
        }
      }

      aToCreate.forEach(function (oItem) {
        iPending++;

        oModel.create("/PersonProjects", {
          PersId: sPersId,
          ProjectId: oItem.ProjectId,
          AssignedDate: new Date(),
          RoleInProject: oItem.Role || "",
          ActiveProject: true,
          HoursAllocated: oItem.TotalHours || 0,
          HoursSpent: oItem.HoursSpent || 0
        }, {
          success: function () {
            iPending--;
            fnDone();
          },
          error: function () {
            bError = true;
            MessageBox.error("A project could not be assigned.");
          }
        });
      });

      aToDelete.forEach(function (oItem) {
        iPending++;

        var sPath = oModel.createKey("/PersonProjects", {
          PersId: sPersId,
          ProjectId: oItem.ProjectId
        });

        oModel.remove(sPath, {
          success: function () {
            iPending--;
            fnDone();
          },
          error: function () {
            bError = true;
            MessageBox.error("A project could not be removed.");
          }
        });
      });
    },

    onNavBack: function () {
      var oAssignModel = this.getView().getModel("assignProject");

      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: String(oAssignModel.getProperty("/sectorId")),
        persId: String(oAssignModel.getProperty("/persId"))
      });
    }
  });
});