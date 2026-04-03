sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox"
], function (Controller, JSONModel, History, MessageBox) {
    "use strict";

    return Controller.extend("hrproject.controller.myProjects.ProjectList", {

        onInit: function () {
            var oModel = new JSONModel({
                title: "My Projects",
                busy:  false,
                items: []
            });
            this.getView().setModel(oModel, "projectList");

            this.getOwnerComponent()
                .getRouter()
                .getRoute("RouteProjectList")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var oArgs      = oEvent.getParameter("arguments");
            this._sPersId  = oArgs.persId;
            this._sType    = oArgs.type;

            var sTitleMap = {
                ongoing:  "Ongoing Projects",
                finished: "Finished Projects",
                all:      "All Company Projects"
            };
            this.getView().getModel("projectList")
                .setProperty("/title", sTitleMap[this._sType] || "Projects");

            if (this._sType === "all") {
                this._loadAllCompanyProjects();
            } else {
                this._loadMyAssignedProjects();
            }
        },

        // ─── Ongoing / Finished: from PersonProjects ──────────────────
        _loadMyAssignedProjects: function () {
            var oListModel  = this.getView().getModel("projectList");
            var oOData      = this.getOwnerComponent().getModel();
            var sPersId     = this._sPersId;
            var sType       = this._sType;

            oListModel.setProperty("/busy", true);
            oListModel.setProperty("/items", []);

            // Use urlParameters.$filter — same pattern as MyCourses
            var sFilter = "PersId eq '" + sPersId + "' and ActiveProject eq " +
                          (sType === "ongoing" ? "true" : "false");

            oOData.read("/PersonProjects", {
                urlParameters: { "$filter": sFilter },
                success: function (oData) {
                    var aAssigned = oData.results || [];
                    if (aAssigned.length === 0) {
                        oListModel.setProperty("/busy", false);
                        return;
                    }
                    this._enrichAssignedWithProjects(aAssigned, oListModel);
                }.bind(this),
                error: function () {
                    oListModel.setProperty("/busy", false);
                    MessageBox.error("Could not load projects.");
                }
            });
        },

        // Enrich PersonProjects rows with Projects master data
        _enrichAssignedWithProjects: function (aAssigned, oListModel) {
            var oOData    = this.getOwnerComponent().getModel();
            var aEnriched = [];
            var iTotal    = aAssigned.length;
            var iDone     = 0;

            var fnFinalize = function () {
                iDone++;
                if (iDone === iTotal) {
                    aEnriched.sort(function (a, b) { return a.ProjectId - b.ProjectId; });
                    oListModel.setProperty("/items", aEnriched);
                    oListModel.setProperty("/busy", false);
                }
            };

            aAssigned.forEach(function (oAssignment) {
                var sProjectId = oAssignment.ProjectId;
                var bActive    = oAssignment.ActiveProject === true  ||
                                 oAssignment.ActiveProject === "true" ||
                                 oAssignment.ActiveProject === "X";

                oOData.read("/Projects(" + sProjectId + ")", {
                    success: function (oProject) {
                        aEnriched.push({
                            ProjectId:       sProjectId,
                            ProjectName:     oProject.ProjectName     || "Project " + sProjectId,
                            ProjectDesc:     oProject.ProjectDesc     || "",
                            ProjectCategory: oProject.ProjectCategory || "",
                            Priority:        oProject.Priority        || "—",
                            Status:          oProject.Status          || "",
                            RoleInProject:   oAssignment.RoleInProject || "—",
                            AssignedDate:    oAssignment.AssignedDate  || "",
                            HoursAllocated:  Number(oAssignment.HoursAllocated || 0),
                            HoursSpent:      Number(oAssignment.HoursSpent     || 0),
                            ActiveProject:   bActive,
                            StatusText:      bActive ? "In Progress" : "Completed",
                            StatusState:     bActive ? "Warning"     : "Success",
                            AssignedBadge:   "Assigned",
                            AssignedState:   "Success",
                            PersId:          String(oAssignment.PersId)
                        });
                        fnFinalize();
                    },
                    error: function () {
                        aEnriched.push({
                            ProjectId:      sProjectId,
                            ProjectName:    "Project " + sProjectId,
                            Priority:       "—",
                            RoleInProject:  oAssignment.RoleInProject || "—",
                            HoursAllocated: Number(oAssignment.HoursAllocated || 0),
                            HoursSpent:     Number(oAssignment.HoursSpent     || 0),
                            ActiveProject:  bActive,
                            StatusText:     bActive ? "In Progress" : "Completed",
                            StatusState:    bActive ? "Warning"     : "Success",
                            AssignedBadge:  "Assigned",
                            AssignedState:  "Success",
                            PersId:         String(oAssignment.PersId)
                        });
                        fnFinalize();
                    }
                });
            });
        },

        // ─── All Company Projects: /Projects + assignment overlay ─────
        _loadAllCompanyProjects: function () {
            var oListModel = this.getView().getModel("projectList");
            var oOData     = this.getOwnerComponent().getModel();
            var sPersId    = this._sPersId;

            oListModel.setProperty("/busy", true);
            oListModel.setProperty("/items", []);

            var aAllProjects   = null;
            var aMyAssignments = null;

            var fnMerge = function () {
                if (aAllProjects === null || aMyAssignments === null) { return; }

                var oAssignedMap = {};
                aMyAssignments.forEach(function (a) {
                    var bActive = a.ActiveProject === true  ||
                                  a.ActiveProject === "true" ||
                                  a.ActiveProject === "X";
                    oAssignedMap[String(a.ProjectId)] = {
                        assigned:       true,
                        activeProject:  bActive,
                        roleInProject:  a.RoleInProject   || "—",
                        hoursAllocated: Number(a.HoursAllocated || 0),
                        hoursSpent:     Number(a.HoursSpent     || 0),
                        persId:         String(a.PersId)
                    };
                });

                var aItems = aAllProjects.map(function (oProject) {
                    var sId       = String(oProject.ProjectId);
                    var oAssigned = oAssignedMap[sId];
                    var bAssigned = !!oAssigned;

                    return {
                        ProjectId:       oProject.ProjectId,
                        ProjectName:     oProject.ProjectName     || "Project " + sId,
                        ProjectDesc:     oProject.ProjectDesc     || "",
                        ProjectCategory: oProject.ProjectCategory || "",
                        Priority:        oProject.Priority        || "—",
                        Status:          oProject.Status          || "",
                        RoleInProject:   bAssigned ? oAssigned.roleInProject  : "",
                        HoursAllocated:  bAssigned ? oAssigned.hoursAllocated : 0,
                        HoursSpent:      bAssigned ? oAssigned.hoursSpent     : 0,
                        StatusText:      oProject.Status || "—",
                        StatusState:     oProject.Status === "In Progress" ? "Warning"
                                         : oProject.Status === "Completed"  ? "Success"
                                         : "None",
                        AssignedBadge:   bAssigned ? "Assigned"  : "Not Assigned",
                        AssignedState:   bAssigned ? "Success"   : "None",
                        PersId:          bAssigned ? oAssigned.persId : ""
                    };
                });

                aItems.sort(function (a, b) { return a.ProjectId - b.ProjectId; });
                oListModel.setProperty("/items", aItems);
                oListModel.setProperty("/busy", false);
            };

            // Parallel reads
            oOData.read("/Projects", {
                success: function (oData) {
                    aAllProjects = oData.results || [];
                    fnMerge();
                },
                error: function () {
                    oListModel.setProperty("/busy", false);
                    MessageBox.error("Could not load projects.");
                }
            });

            oOData.read("/PersonProjects", {
                urlParameters: { "$filter": "PersId eq '" + sPersId + "'" },
                success: function (oData) {
                    aMyAssignments = oData.results || [];
                    fnMerge();
                },
                error: function () {
                    aMyAssignments = [];
                    fnMerge();
                }
            });
        },

        // ─── Navigate to existing ProjectDetail ───────────────────────
        onProjectPress: function (oEvent) {
            var oItem = oEvent.getSource
                ? oEvent.getSource()
                : oEvent.getParameter("listItem");

            var oCtx = oItem.getBindingContext("projectList");
            if (!oCtx) { return; }

            var oData = oCtx.getObject();

            if (!oData.PersId) {
                MessageBox.information("You are not assigned to this project.");
                return;
            }

            // sectorId="0" → ProjectDetail.onNavBack returns to RouteProjectList
            this.getOwnerComponent().getRouter().navTo("RouteProjectDetail", {
                sectorId:  "0",
                persId:    String(oData.PersId),
                projectId: String(oData.ProjectId)
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMyProjects", {
                persId: this._sPersId
            });
        }
    });
});