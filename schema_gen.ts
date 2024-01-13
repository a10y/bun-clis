// Generate using OpenAI with their Function Calling interface
// We can generate one of these from a Zod object as well.
import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/index.mjs";

// Create a new client using our key

const openai = new OpenAI({
  apiKey: Bun.env.OPENAI_API_KEY!,
});

const JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    organizationName: {
      type: "string",
    },
    auditorName: {
      type: "string",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          line: {
            type: "number",
          },
          text: {
            type: "string",
          },
        },
      },
    },
    hasNoFindings: {
      type: "boolean",
    },
  },
  required: [
    "organizationName",
    "auditorName",
    "documentId",
    "hasNoFindings",
    "findings",
  ],
};

const EXTRACT_FUNC_NAME = "extract";
const TOOLS: Array<ChatCompletionTool> = [
  {
    type: "function",
    function: {
      name: EXTRACT_FUNC_NAME,
      description:
        "Receives the parameters of the extraction and stores them in a database. " +
        "This includes the fields " +
        "`organizationName`, which is the name of the organization/grantee being audited, " +
        "`auditorName`, which is the name of the auditing agency or accounting firm, " +
        "`findings`, a string[] of findings where each element is a `line` number for where the line is sourced, and `text` containing the *exact* word-for-word extracted finding text from the audit, " +
        "`hasNoFindings`, which is true only if there are no findings",
      parameters: JSON_SCHEMA,
    },
  },
];

function linify(text: string) {
  const lines = [];
  const splits = text.split(/\n+/);
  for (let i = 0; i < splits.length; i++) {
    lines.push({ line: i, text: splits[i] });
  }
  return lines;
}

const AUDIT_NO_FINDINGS = JSON.stringify(
  linify(
    `
AUDIT FILING

SAINT LOUIS CHILDRENS HOSPITAL

This is the comprehensive audit for Saint Louis Childrens Hospital, for grants totally $7, 360,456.46 for FiscAL
Year 2023. This audit is being performed by Halpern & Rose LLP.

The audit surfaced no findings, their funds appear to be in order and compliance controls are properly in place.
`.trim()
  )
);

const AUDIT_ONE_FINDING = JSON.stringify(
  linify(
    `
AUDIT FILING

SAINT LOUIS CHILDRENS HOSPITAL

This is the comprehensive audit for Saint Louis Childrens Hospital, for grants totally $7, 360,456.46 for FiscAL
Year 2023. This audit is being performed by Halpern & Rose LLP.

The audit surfaced a finding due to compliance control number 4993 in 2CFR subsection A. The grantee was found
to be delinquent in keeping receipts related to coffee machine refills.

There were no other findings.
`.trim()
  )
);

async function extractAuditFindings(auditText: string) {
  console.log("using auditText", auditText);
  const functionCall = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are assisting an Audit Resolution Specialist with the Federal Audit Clearinghouse (FAC) processing audit applications. Your user, specialist-1, will ask you questions, you will answer honestly and concisely. Provide sentences instead of paragraphs, and bullet points instead of sentences where appropriate. If you cannot answer their question given your context, be clear and say so.",
      },
      {
        role: "user",
        name: "specialist-1",
        content: `
Here is an Audit package for you to parse, captured between a pair of <audit></audit> tags:

<audit>
${auditText}
</audit>

Please use the ${EXTRACT_FUNC_NAME} tool to save an extracted copy of the audit findings.
            `.trim(),
      },
    ],
    model: "gpt-3.5-turbo-16k-0613",
    tools: TOOLS,
    tool_choice: { type: "function", function: { name: EXTRACT_FUNC_NAME } },
  });

  // Once we have a tool perform the function call instead.
  // How can you give it the ability to run these function calls multiple times in a row.
  const toolCall = functionCall.choices[0]!;
  return JSON.parse(toolCall.message.tool_calls![0].function.arguments);
}

const results = [
  {
    expected: "NO FINDINGS",
    actual: await extractAuditFindings(AUDIT_NO_FINDINGS),
  },
  {
    expected: "1 FINDING",
    actual: await extractAuditFindings(AUDIT_ONE_FINDING),
  },
];

console.table(results);
