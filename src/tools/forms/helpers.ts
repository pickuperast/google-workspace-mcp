import { forms_v1 } from 'googleapis';
import { z } from 'zod';

export const formQuestionSchema = z
  .object({
    title: z.string().min(1).describe('Question text shown to the respondent.'),
    description: z.string().optional().describe('Optional help text below the question.'),
    type: z
      .enum([
        'SHORT_TEXT',
        'PARAGRAPH_TEXT',
        'RADIO',
        'CHECKBOX',
        'DROPDOWN',
        'SCALE',
        'DATE',
        'TIME',
      ])
      .optional()
      .default('SHORT_TEXT')
      .describe('Question type to create.'),
    required: z.boolean().optional().default(false).describe('Whether this question is required.'),
    options: z
      .array(z.string().min(1))
      .optional()
      .describe('Options for RADIO, CHECKBOX, or DROPDOWN questions.'),
    includeOtherOption: z
      .boolean()
      .optional()
      .default(false)
      .describe('Add an "Other" option for RADIO or CHECKBOX questions.'),
    shuffleOptions: z
      .boolean()
      .optional()
      .default(false)
      .describe('Shuffle choice options for respondents.'),
    low: z.number().int().min(0).max(1).optional().default(1).describe('Lowest value for SCALE.'),
    high: z
      .number()
      .int()
      .min(2)
      .max(10)
      .optional()
      .default(5)
      .describe('Highest value for SCALE.'),
    lowLabel: z.string().optional().describe('Label for the low end of a SCALE question.'),
    highLabel: z.string().optional().describe('Label for the high end of a SCALE question.'),
    includeYear: z.boolean().optional().default(true).describe('Include year for DATE questions.'),
    includeTime: z.boolean().optional().default(false).describe('Include time for DATE questions.'),
    duration: z
      .boolean()
      .optional()
      .default(false)
      .describe('Ask for duration instead of time of day for TIME questions.'),
  })
  .superRefine((value, ctx) => {
    if (
      ['RADIO', 'CHECKBOX', 'DROPDOWN'].includes(value.type) &&
      (!value.options || value.options.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choice questions require at least one option.',
        path: ['options'],
      });
    }
    if (value.type === 'DROPDOWN' && value.includeOtherOption) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Google Forms only allows the Other option on RADIO and CHECKBOX questions.',
        path: ['includeOtherOption'],
      });
    }
    if (value.type === 'SCALE' && value.low >= value.high) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SCALE low must be less than high.',
        path: ['low'],
      });
    }
  });

export type FormQuestionInput = z.infer<typeof formQuestionSchema>;

export function buildQuestionItem(input: FormQuestionInput): forms_v1.Schema$Item {
  const question: forms_v1.Schema$Question = {
    required: input.required,
  };

  switch (input.type) {
    case 'PARAGRAPH_TEXT':
      question.textQuestion = { paragraph: true };
      break;
    case 'RADIO':
    case 'CHECKBOX':
    case 'DROPDOWN':
      question.choiceQuestion = {
        type: input.type === 'DROPDOWN' ? 'DROP_DOWN' : input.type,
        options: [
          ...(input.options || []).map((value) => ({ value })),
          ...(input.includeOtherOption ? [{ isOther: true }] : []),
        ],
        shuffle: input.shuffleOptions,
      };
      break;
    case 'SCALE':
      question.scaleQuestion = {
        low: input.low,
        high: input.high,
        lowLabel: input.lowLabel,
        highLabel: input.highLabel,
      };
      break;
    case 'DATE':
      question.dateQuestion = {
        includeYear: input.includeYear,
        includeTime: input.includeTime,
      };
      break;
    case 'TIME':
      question.timeQuestion = { duration: input.duration };
      break;
    case 'SHORT_TEXT':
    default:
      question.textQuestion = { paragraph: false };
      break;
  }

  return {
    title: input.title,
    description: input.description,
    questionItem: { question },
  };
}

export function summarizeForm(form: forms_v1.Schema$Form) {
  return {
    formId: form.formId,
    title: form.info?.title,
    documentTitle: form.info?.documentTitle,
    description: form.info?.description,
    responderUri: form.responderUri,
    linkedSheetId: form.linkedSheetId,
    revisionId: form.revisionId,
    publishSettings: form.publishSettings,
    settings: form.settings,
    items: (form.items || []).map((item, index) => ({
      index,
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      questionId: item.questionItem?.question?.questionId,
      question: item.questionItem?.question,
      hasTextItem: Boolean(item.textItem),
      hasPageBreak: Boolean(item.pageBreakItem),
    })),
  };
}

export function simplifyFormResponse(response: forms_v1.Schema$FormResponse) {
  return {
    responseId: response.responseId,
    formId: response.formId,
    createTime: response.createTime,
    lastSubmittedTime: response.lastSubmittedTime,
    respondentEmail: response.respondentEmail,
    totalScore: response.totalScore,
    answers: Object.fromEntries(
      Object.entries(response.answers || {}).map(([questionId, answer]) => [
        questionId,
        {
          questionId: answer.questionId,
          textAnswers: answer.textAnswers?.answers?.map((textAnswer) => textAnswer.value) || [],
          grade: answer.grade,
          fileUploadAnswers: answer.fileUploadAnswers,
        },
      ])
    ),
  };
}
