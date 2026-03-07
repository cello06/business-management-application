sap.ui.define([], function () {
  "use strict";

  return {
    maskTcId: function (sValue) {
      if (!sValue) {
        return "";
      }

      sValue = String(sValue);

      if (sValue.length <= 6) {
        return "******";
      }

      return sValue.slice(0, sValue.length - 6) + "******";
    }
  };
});