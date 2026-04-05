sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Input",
  "sap/m/Label",
  "sap/m/VBox",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/json/JSONModel"
], function (
  Controller,
  Dialog,
  Button,
  Input,
  Label,
  VBox,
  MessageToast,
  MessageBox,
  JSONModel
) {
  "use strict";

  return Controller.extend("hrproject.controller.Home", {

    onInit: function () {
      const oHomeModel = new JSONModel({
        sectorCount: 0,
        isAdmin: false,
        roleLoaded: false,
        persId: null,
        hero1: "hero.jpg",
        hero2: "hero2.jpg",
        hero3: "hero3.jpg",
        hero4: "hero4.jpg"
      });

      this.getView().setModel(oHomeModel, "home");
      this._loadUserRole();
      this._loadSectorCount();

      this._heroTimer = null;
      this._heroIntervalMs = 2500;
    },

    // ── Role detection ──────────────────────────────────────────────
    _loadUserRole: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oHomeModel = this.getView().getModel("home");

      oHomeModel.setProperty("/roleLoaded", false);
      oHomeModel.setProperty("/isAdmin", false);

      // Safety fallback: if OData never responds, show employee tiles after 5s
      const iFallbackTimer = setTimeout(function () {
        if (!oHomeModel.getProperty("/roleLoaded")) {
          console.warn("UserRoles request timed out - showing employee tiles as fallback.");
          oHomeModel.setProperty("/isAdmin", false);
          oHomeModel.setProperty("/roleLoaded", true);
        }
      }, 5000);

      // Resolve SAP username
      let sUsername = "";
      try {
        sUsername = sap.ushell.Container.getService("UserInfo").getId();
        console.log("UserInfo.getId() returned:", sUsername);
      } catch (e) {
        console.warn("UserInfo service not available:", e.message);
      }

      if (!sUsername || sUsername === "DEFAULT_USER") {
        console.warn("Falling back to hardcoded username: CAKTURK");
        sUsername = "CAKTURK";
      }

      console.log("Querying UserRoles for username:", sUsername);

      const sFinalUsername = sUsername;

      oModel.read("/UserRoles", {
        urlParameters: {
          "$filter": "SapUsername eq '" + sFinalUsername + "'",
          "$select": "SapUsername,Role",
          "$top": "1"
        },
        success: function (oData) {
          clearTimeout(iFallbackTimer);
          console.log("UserRoles response:", JSON.stringify(oData));

          if (!oData.results || oData.results.length === 0) {
            console.warn("No UserRoles record found for:", sFinalUsername);
            oHomeModel.setProperty("/isAdmin", false);
            oHomeModel.setProperty("/roleLoaded", true);
            // Still load PersId even if no role found (default to employee)
            this._loadPersId(sFinalUsername, oHomeModel, oModel);
            return;
          }

          const sRole = oData.results[0].Role;
          const bIsAdmin = (sRole || "").toUpperCase() === "ADMIN";
          console.log("Role found:", sRole, "-> isAdmin:", bIsAdmin);

          oHomeModel.setProperty("/isAdmin", bIsAdmin);
          oHomeModel.setProperty("/roleLoaded", true);

          // ALWAYS load PersId regardless of admin or employee role
          this._loadPersId(sFinalUsername, oHomeModel, oModel);
        }.bind(this),
        error: function (oErr) {
          clearTimeout(iFallbackTimer);
          console.error("UserRoles read failed. Status:", oErr && oErr.statusCode,
            "Response:", oErr && oErr.responseText);
          oHomeModel.setProperty("/isAdmin", false);
          oHomeModel.setProperty("/roleLoaded", true);
        }
      });
    },

    // ── PersId loader (called for ALL users, admin or employee) ─────
    _loadPersId: function (sUsername, oHomeModel, oModel) {
      var oComp = this.getOwnerComponent();

      oModel.read("/Employees", {
        urlParameters: {
          "$filter": "SapUsername eq '" + sUsername + "'",
          "$select": "PersId,SapUsername",
          "$top": "1"
        },
        success: function (oEmpData) {
          if (oEmpData.results && oEmpData.results.length > 0) {
            var sPersId = oEmpData.results[0].PersId.toString();
            console.log("PersId resolved:", sPersId);
            oHomeModel.setProperty("/persId", sPersId);
            oHomeModel.setProperty("/sapUsername", sUsername);
            // Store on component for cross-controller access
            oComp._sPersId      = sPersId;
            oComp._sSapUsername = sUsername;
          } else {
            console.warn("No Employee record found for SapUsername:", sUsername);
          }
        },
        error: function (oErr) {
          console.error("Employees read failed:", oErr && oErr.responseText);
          MessageToast.show("Could not load employee profile.");
        }
      });
    },

    // ── Carousel ────────────────────────────────────────────────────
    onAfterRendering: function () {
      this._startHeroCarousel();

      const oCarousel = this.byId("heroCarousel");
      if (oCarousel) {
        const $dom = oCarousel.$();
        $dom.off("mouseenter.hero mouseleave.hero");
        $dom.on("mouseenter.hero", this._stopHeroCarousel.bind(this));
        $dom.on("mouseleave.hero", this._startHeroCarousel.bind(this));
      }
    },

    onExit: function () {
      this._stopHeroCarousel();
    },

    _startHeroCarousel: function () {
      const oCarousel = this.byId("heroCarousel");
      if (!oCarousel) return;
      this._stopHeroCarousel();
      this._heroTimer = setInterval(function () {
        if (document.hidden) return;
        oCarousel.next();
      }, this._heroIntervalMs);
    },

    _stopHeroCarousel: function () {
      if (this._heroTimer) {
        clearInterval(this._heroTimer);
        this._heroTimer = null;
      }
    },

    onHeroHover: function () { this._stopHeroCarousel(); },
    onHeroOut: function () { this._startHeroCarousel(); },

    // ── Sector count ────────────────────────────────────────────────
    _loadSectorCount: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oHomeModel = this.getView().getModel("home");

      oModel.read("/Sectors/$count", {
        success: function (oData) {
          const s = (typeof oData === "string") ? oData
            : (oData && oData.toString ? oData.toString() : "0");
          oHomeModel.setProperty("/sectorCount", parseInt(s, 10) || 0);
        },
        error: function () {
          oHomeModel.setProperty("/sectorCount", 0);
        }
      });
    },

    // ── Admin tile handlers ──────────────────────────────────────────
    onOpenSectors: function () {
      this.getOwnerComponent().getRouter().navTo("RouteSectors");
    },

    onCreateDepartment: function () {
      if (!this._oCreateDeptDialog) {
        const oVM = new JSONModel({ sectorName: "" });
        this.getView().setModel(oVM, "createDept");

        this._oDeptNameInput = new Input({
          value: "{createDept>/sectorName}",
          placeholder: "Enter department name",
          width: "100%"
        });

        this._oCreateDeptDialog = new Dialog({
          title: "Create Department",
          contentWidth: "520px",
          draggable: true,
          resizable: true,
          content: new VBox({
            width: "100%",
            items: [
              new Label({ text: "Department Name", labelFor: this._oDeptNameInput }),
              this._oDeptNameInput
            ]
          }),
          beginButton: new Button({
            text: "Create",
            type: "Emphasized",
            press: this._onCreateDepartmentConfirm.bind(this)
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () {
              this._oCreateDeptDialog.close();
            }.bind(this)
          }),
          afterClose: function () {
            this.getView().getModel("createDept").setProperty("/sectorName", "");
          }.bind(this)
        });

        this._oCreateDeptDialog.addStyleClass(
          "sapUiResponsivePadding--content sapUiResponsivePadding--header sapUiResponsivePadding--footer"
        );
        this.getView().addDependent(this._oCreateDeptDialog);
      }

      this._oCreateDeptDialog.open();
      setTimeout(() => this._oDeptNameInput.focus(), 0);
    },

    _onCreateDepartmentConfirm: function () {
      const sName = (this._oDeptNameInput.getValue() || "").trim();
      if (!sName) {
        MessageBox.warning("Please enter a department name.");
        return;
      }

      const oModel = this.getOwnerComponent().getModel();
      this.getView().setBusy(true);

      oModel.read("/Sectors", {
        urlParameters: {
          "$select": "SectorId",
          "$orderby": "SectorId desc",
          "$top": "1"
        },
        success: function (oData) {
          let iMax = 0;
          if (oData && oData.results && oData.results.length > 0) {
            iMax = parseInt(oData.results[0].SectorId, 10) || 0;
          }

          oModel.create("/Sectors", {
            SectorId: iMax + 1,
            SectorName: sName
          }, {
            success: function () {
              MessageToast.show("Department created.");
              this._oCreateDeptDialog.close();
              oModel.refresh(true);
              this._loadSectorCount();
              this.getView().setBusy(false);
            }.bind(this),
            error: function (oErr) {
              this.getView().setBusy(false);
              let sMsg = "Create failed.";
              try {
                const oJson = JSON.parse(oErr && oErr.responseText);
                const vMsg = oJson?.error?.message?.value;
                if (vMsg) sMsg = vMsg;
              } catch (e) { }
              MessageBox.error(sMsg);
            }.bind(this)
          });
        }.bind(this),
        error: function () {
          this.getView().setBusy(false);
          MessageBox.error("Could not read max SectorId. Please try again.");
        }.bind(this)
      });
    },

    // ── Employee tile handlers ───────────────────────────────────────
    onMyCourses: function () {
      const sPersId = this.getView().getModel("home").getProperty("/persId");
      if (!sPersId) {
        MessageToast.show("Please wait, loading your profile...");
        return;
      }
      this.getOwnerComponent().getRouter().navTo("RouteMyCourses", {
        persId: sPersId
      });
    },

    onMyProjects: function () {
      const sPersId = this.getView().getModel("home").getProperty("/persId");
      if (!sPersId) {
        MessageToast.show("Please wait, loading your profile...");
        return;
      }
      this.getOwnerComponent().getRouter().navTo("RouteMyProjects", {
        persId: sPersId
      });
    },

    onDailyActivities: function () {
      const sPersId = this.getView().getModel("home").getProperty("/persId");
      if (!sPersId) {
        MessageToast.show("Please wait, loading your profile...");
        return;
      }
      this.getOwnerComponent().getRouter().navTo("RouteDailyActivities", {
        persId: sPersId
      });
    },

    onMyCalendar: function () {
      const sPersId = this.getView().getModel("home").getProperty("/persId");
      if (!sPersId) {
        MessageToast.show("Please wait, loading your profile...");
        return;
      }
      this.getOwnerComponent().getRouter().navTo("RouteMyCalendar", {
        persId: sPersId
      });
    },

    onMyProfile: function () {
      MessageToast.show("My Profile - coming soon.");
    },

    onEmployeeRegistration: function () {
      MessageToast.show("Employee Registration - next step!");
    },

    onCourseRegistration: function () {
      MessageToast.show("Course Registration - next step!");
    },

    // ── Image helper ─────────────────────────────────────────────────
    getImagePath: function (sFileName) {
      if (!sFileName) return "";
      const sBase = jQuery.sap
        ? jQuery.sap.getModulePath("hrproject")
        : sap.ui.require.toUrl("hrproject");
      return sBase + "/img/" + sFileName;
    }
  });
});