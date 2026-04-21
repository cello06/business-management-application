sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("hrproject.controller.feedback.Feedback", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        busy       : false,
        type       : "BUG",
        subject    : "",
        description: "",
        attachments: []   // [{ fileName, mimeType, sizeText, size, contentBase64 }]
      }), "feedback");

      this.getOwnerComponent().getRouter()
        .getRoute("RouteFeedback")
        .attachPatternMatched(this._onRouteMatched, this);

      // Capture clipboard images pasted while the Description field is focused.
      // attachBrowserEvent re-binds automatically across re-renders.
      var oDesc = this.byId("descArea");
      if (oDesc) {
        oDesc.attachBrowserEvent("paste", this._onDescPaste, this);
      }
    },

    _onRouteMatched: function () {
      // Reset form every time the route is entered
      this.getView().getModel("feedback").setData({
        busy       : false,
        type       : "BUG",
        subject    : "",
        description: "",
        attachments: []
      });
      var oUploader = this.byId("feedbackUploader");
      if (oUploader) { oUploader.clear(); }
    },

    // ── Navigation ──────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteHome");
    },

    onCancel: function () {
      this.onNavBack();
    },

    // ── File handling ───────────────────────────────────────────────
    onTypeMismatch: function () {
      MessageToast.show("File type not allowed. Use images or PDF.");
    },

    onFilesSelected: function (oEvent) {
      var oFiles = oEvent.getParameter("files");
      if (!oFiles || !oFiles.length) { return; }

      var oVm = this.getView().getModel("feedback");
      var aCurrent = oVm.getProperty("/attachments") || [];

      var aReads = [];
      for (var i = 0; i < oFiles.length; i++) {
        aReads.push(this._readFileAsBase64(oFiles[i]));
      }
      Promise.all(aReads).then(function (aNew) {
        oVm.setProperty("/attachments", aCurrent.concat(aNew));
      }).catch(function (oErr) {
        MessageBox.error("File read failed: " + (oErr && oErr.message || oErr));
      });

      // Allow re-selection of same file
      var oUploader = this.byId("feedbackUploader");
      if (oUploader) { oUploader.clear(); }
    },

    _readFileAsBase64: function (oFile) {
      return new Promise(function (resolve, reject) {
        var oReader = new FileReader();
        oReader.onload = function () {
          var sResult = oReader.result || "";
          var iComma  = sResult.indexOf(",");
          var sB64    = iComma >= 0 ? sResult.substring(iComma + 1) : sResult;
          resolve({
            fileName     : oFile.name,
            mimeType     : oFile.type || "application/octet-stream",
            size         : oFile.size,
            sizeText     : (oFile.size / 1024).toFixed(1) + " KB",
            contentBase64: sB64
          });
        };
        oReader.onerror = function () { reject(oReader.error); };
        oReader.readAsDataURL(oFile);
      });
    },

    // ── Clipboard paste → attachment ────────────────────────────────
    _onDescPaste: function (oEvent) {
      var oOrig = oEvent.originalEvent || oEvent;
      var oClip = oOrig.clipboardData || window.clipboardData;
      if (!oClip || !oClip.items) { return; }

      var aBlobs = [];
      for (var i = 0; i < oClip.items.length; i++) {
        var oItem = oClip.items[i];
        if (oItem.kind === "file" && /^image\//.test(oItem.type)) {
          var oBlob = oItem.getAsFile();
          if (oBlob) { aBlobs.push(oBlob); }
        }
      }
      if (!aBlobs.length) { return; }   // plain text paste → let the browser handle it

      // Prevent the image bytes (or its data-URL representation) from landing in the textarea
      oEvent.preventDefault();
      if (oOrig.preventDefault) { oOrig.preventDefault(); }

      var oVm      = this.getView().getModel("feedback");
      var aCurrent = oVm.getProperty("/attachments") || [];
      var iSeed    = aCurrent.length;

      var aReads = aBlobs.map(function (oBlob, iIdx) {
        var sExt  = (oBlob.type.split("/")[1] || "png").toLowerCase();
        var sName = oBlob.name && oBlob.name !== "image.png"
          ? oBlob.name
          : "screenshot-" + Date.now() + "-" + (iSeed + iIdx + 1) + "." + sExt;
        var oNamedFile = (typeof File === "function")
          ? new File([oBlob], sName, { type: oBlob.type })
          : (function () { oBlob.name = sName; return oBlob; })();
        return this._readFileAsBase64(oNamedFile);
      }.bind(this));

      Promise.all(aReads).then(function (aNew) {
        oVm.setProperty("/attachments", aCurrent.concat(aNew));
        MessageToast.show(aNew.length > 1
          ? aNew.length + " screenshots added as attachments."
          : "Screenshot added as attachment.");
      }).catch(function (oErr) {
        MessageBox.error("Screenshot paste failed: " + (oErr && oErr.message || oErr));
      });
    },

    onRemoveAttachment: function (oEvent) {
      var oCtx  = oEvent.getSource().getBindingContext("feedback");
      if (!oCtx) { return; }
      var iIdx  = parseInt(oCtx.getPath().split("/").pop(), 10);
      var oVm   = this.getView().getModel("feedback");
      var aList = (oVm.getProperty("/attachments") || []).slice();
      aList.splice(iIdx, 1);
      oVm.setProperty("/attachments", aList);
    },

    // ── Submit ──────────────────────────────────────────────────────
    onSubmit: function () {
      var oView  = this.getView();
      var oComp  = this.getOwnerComponent();
      var oModel = oComp.getModel();
      var oVm    = oView.getModel("feedback");
      var oData  = oVm.getData();

      var sSubject = (oData.subject || "").trim();
      var sDesc    = (oData.description || "").trim();

      if (!sSubject) {
        MessageBox.warning("Please enter a subject."); return;
      }
      if (!sDesc) {
        MessageBox.warning("Please enter a description."); return;
      }

      oVm.setProperty("/busy", true);

      this._getNextFeedbackId(oModel, function (sNewId) {
        var oNow = new Date();
        var sCreatedOn = "/Date(" + Date.UTC(
          oNow.getFullYear(), oNow.getMonth(), oNow.getDate()
        ) + ")/";
        var sCreatedAt = "PT"
          + String(oNow.getUTCHours()).padStart(2, "0")   + "H"
          + String(oNow.getUTCMinutes()).padStart(2, "0") + "M"
          + String(oNow.getUTCSeconds()).padStart(2, "0") + "S";

        var oPayload = {
          FeedbackId : sNewId,
          SapUsername: oComp._sSapUsername || "",
          PersId     : oComp._sPersId || "",
          Type       : oData.type,
          Subject    : sSubject,
          Description: sDesc,
          Status     : "OPEN",
          CreatedOn  : sCreatedOn,
          CreatedAt  : sCreatedAt
        };

        oModel.create("/Feedback", oPayload, {
          success: function () {
            this._postAttachments(oModel, sNewId, oData.attachments || [], 0, function (aFailed) {
              oVm.setProperty("/busy", false);
              if (aFailed && aFailed.length) {
                MessageBox.warning(
                  "Feedback saved, but these attachments failed:\n- "
                  + aFailed.join("\n- ")
                );
              } else {
                MessageToast.show("Feedback submitted. Thank you!");
              }
              this.getOwnerComponent().getRouter().navTo("RouteHome");
            }.bind(this));
          }.bind(this),
          error: function (oErr) {
            oVm.setProperty("/busy", false);
            MessageBox.error(this._extractErr(oErr, "Submit failed."));
          }.bind(this)
        });
      }.bind(this));
    },

    // Resolve next FeedbackId. Always invokes fnCallback with a 10-char padded
    // string. If the table is empty or the read errors, falls back to "0000000001".
    _getNextFeedbackId: function (oModel, fnCallback) {
      oModel.read("/Feedback", {
        urlParameters: {
          "$select" : "FeedbackId",
          "$orderby": "FeedbackId desc",
          "$top"    : "1"
        },
        success: function (oRes) {
          var iMax = 0;
          if (oRes && oRes.results && oRes.results.length > 0) {
            iMax = parseInt(oRes.results[0].FeedbackId, 10) || 0;
          }
          fnCallback((iMax + 1).toString().padStart(10, "0"));
        },
        error: function () {
          fnCallback("0000000001");
        }
      });
    },

    // Sequential attachment POSTs. Collects failed file names and reports at end.
    _postAttachments: function (oModel, sFeedbackId, aAtt, iIdx, fnDone, aFailed) {
      aFailed = aFailed || [];
      if (iIdx >= aAtt.length) { fnDone(aFailed); return; }

      var oAtt = aAtt[iIdx];
      var sAttachId = (iIdx + 1).toString().padStart(3, "0");

      oModel.create("/FeedbackAttach", {
        FeedbackId : sFeedbackId,
        AttachId   : sAttachId,
        FileName   : oAtt.fileName,
        MimeType   : oAtt.mimeType,
        FileSize   : oAtt.size,
        FileContent: oAtt.contentBase64
      }, {
        success: function () {
          this._postAttachments(oModel, sFeedbackId, aAtt, iIdx + 1, fnDone, aFailed);
        }.bind(this),
        error: function () {
          aFailed.push(oAtt.fileName);
          this._postAttachments(oModel, sFeedbackId, aAtt, iIdx + 1, fnDone, aFailed);
        }.bind(this)
      });
    },

    _extractErr: function (oErr, sFallback) {
      try {
        var oJson = JSON.parse(oErr && oErr.responseText);
        var sMsg  = oJson && oJson.error && oJson.error.message && oJson.error.message.value;
        return sMsg || sFallback;
      } catch (e) { return sFallback; }
    }

  });
});
