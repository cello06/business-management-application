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
      const oHomeModel = new JSONModel({ sectorCount: 0 });
      this.getView().setModel(oHomeModel, "home");
      this._loadSectorCount();

      // Carousel timer handle
      this._heroTimer = null;
      this._heroIntervalMs = 2500; // 2.5s (istersen 2000/3000 yap)
    },

onAfterRendering: function () {
  this._startHeroCarousel();

  const oCarousel = this.byId("heroCarousel");
  if (oCarousel) {
    const $dom = oCarousel.$(); // jQuery wrapper

    // Önce varsa eski handler’ları kaldır (duplicate olmasın)
    $dom.off("mouseenter.hero mouseleave.hero");

    // Hover -> durdur
    $dom.on("mouseenter.hero", this._stopHeroCarousel.bind(this));

    // Hover çıkınca -> devam
    $dom.on("mouseleave.hero", this._startHeroCarousel.bind(this));
  }
},

    onExit: function () {
      // Controller kapanırken timer temizle
      this._stopHeroCarousel();
    },

    // ===== Carousel helpers =====
    _startHeroCarousel: function () {
      const oCarousel = this.byId("heroCarousel");
      if (!oCarousel) {
        return; // XML'de id yoksa sessiz geç
      }

      // Eski timer varsa kapat
      this._stopHeroCarousel();

      this._heroTimer = setInterval(function () {
        // tab görünür değilse boşuna dönmesin
        if (document.hidden) {
          return;
        }
        oCarousel.next();
      }, this._heroIntervalMs);
    },

    _stopHeroCarousel: function () {
      if (this._heroTimer) {
        clearInterval(this._heroTimer);
        this._heroTimer = null;
      }
    },

    // XML’de event bağlarsan (mouseover/mouseout) pause/resume
    onHeroHover: function () {
      this._stopHeroCarousel();
    },

    onHeroOut: function () {
      this._startHeroCarousel();
    },

    // ===== Existing logic =====
    _loadSectorCount: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oHomeModel = this.getView().getModel("home");

      oModel.read("/Sectors/$count", {
        success: function (oData) {
          const s = (typeof oData === "string") ? oData : (oData && oData.toString ? oData.toString() : "0");
          const iCount = parseInt(s, 10) || 0;
          oHomeModel.setProperty("/sectorCount", iCount);
        },
        error: function () {
          oHomeModel.setProperty("/sectorCount", 0);
        }
      });
    },

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
            press: function () { this._oCreateDeptDialog.close(); }.bind(this)
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

    // 1) Max SectorId oku -> 2) +1 -> 3) Create'e SectorId ile git
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
            const v = oData.results[0].SectorId;
            iMax = parseInt(v, 10) || 0;
          }

          const iNext = iMax + 1;

          oModel.create("/Sectors", {
            SectorId: iNext,
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
                const sText = oErr && oErr.responseText;
                if (sText) {
                  const oJson = JSON.parse(sText);
                  const vMsg = oJson?.error?.message?.value;
                  if (vMsg) sMsg = vMsg;
                }
              } catch (e) { /* ignore */ }

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

    onEmployeeRegistration: function () {
      MessageToast.show("Employee Registration - next step!");
    },

    onCourseRegistration: function () {
      MessageToast.show("Course Registration - next step!");
    }

  });
});