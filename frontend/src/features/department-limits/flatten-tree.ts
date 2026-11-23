import type { Department, InternalEconomicCode } from "@/shared/api/schema";

export const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenDepartments(node.sub_departments)]);

// Присваиваемый внутренний код ЭКР — только лист дерева (та же логика, что в
// payment-form.tsx — промежуточные узлы раздел/подраздел/вид не выбираются
// напрямую как держатель лимита).
export const flattenInternalCodeLeaves = (
  nodes: InternalEconomicCode[],
): InternalEconomicCode[] =>
  nodes.flatMap((node) =>
    node.sub_codes.length === 0
      ? [node]
      : flattenInternalCodeLeaves(node.sub_codes),
  );
