import { describe, it, expect } from "vitest";
import { 
  detectZPLDimensions, 
  parseZPLBlocks 
} from "../lib/zpl-parser";

// Fixture: ZPL real simplificado do Mercado Livre (Etiqueta + DANFE)
const MOCK_ML_ZPL = `
^XA
^FX Etiqueta
^PW812
^LL1218
^FO50,50^A0N,50,50^FDETIQUETA TESTE^FS
^XZ
^XA
^FX DANFE
^PW1600
^LL2400
^FO100,100^A0N,80,80^FDDANFE SIMPLIFICADA^FS
^XZ
`;

const INVALID_ZPL = `
^XA
^FX Bloco Vazio ou Curto
^XZ
^XA
^FX Bloco Sem Comandos Uteis
^FO10,10^FS
^XZ
`;

describe("ZPL Parser & Dimension Detection", () => {
  describe("detectZPLDimensions", () => {
    it("should detect standard 4x6 label dimensions", () => {
      const zpl = "^XA^PW812^LL1218^XZ";
      const dimensions = detectZPLDimensions(zpl);
      expect(dimensions.width).toBe(4);
      expect(dimensions.height).toBe(6);
    });

    it("should detect DANFE dimensions by content", () => {
      const zpl = "^XA^FD DANFE SIMPLIFICADA ^FS^XZ";
      const dimensions = detectZPLDimensions(zpl);
      expect(dimensions.width).toBe(8);
      expect(dimensions.height).toBe(11);
    });

    it("should detect orientation", () => {
      const landscapeZpl = "^XA^PW1218^LL812^XZ";
      const dimensions = detectZPLDimensions(landscapeZpl);
      expect(dimensions.orientation).toBe("landscape");
    });
  });

  describe("parseZPLBlocks", () => {
    it("should extract valid blocks and identify types", () => {
      const blocks = parseZPLBlocks(MOCK_ML_ZPL);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("label");
      expect(blocks[1].type).toBe("danfe");
    });

    it("should filter out invalid or empty blocks", () => {
      const blocks = parseZPLBlocks(INVALID_ZPL);
      expect(blocks).toHaveLength(0);
    });
  });
});
