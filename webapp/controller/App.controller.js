sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel"
    ],
    function (Controller, JSONModel) {
        "use strict";

        return Controller.extend("hrproject.controller.App", {

            onInit: function () {
                // Model for sidebar stats — shared as named model "app"
                var oModel = new JSONModel({
                    sectorCount: "-",
                    employeeCount: "-",
                    courseCount: "-"
                });
                this.getView().setModel(oModel, "app");

                this._loadSidebarCounts();
            },

            // ─── Sidebar toggle ──────────────────────────────
            onSidebarToggle: function () {
                var oToolPage = this.byId("toolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
            },

            // ─── Load counts from OData for sidebar stats ────
            _loadSidebarCounts: function () {
                var oModel = this.getView().getModel("app");
                var oOData = this.getOwnerComponent().getModel(); // default OData model

                // Sectors count
                oOData.read("/Sectors/$count", {
                    success: function (data) {
                        oModel.setProperty("/sectorCount", data);
                    }
                });

                // Employees count
                oOData.read("/Employees/$count", {
                    success: function (data) {
                        oModel.setProperty("/employeeCount", data);
                    }
                });

                // Courses count
                oOData.read("/Courses/$count", {
                    success: function (data) {
                        oModel.setProperty("/courseCount", data);
                    }
                });
            }

        });
    }
);