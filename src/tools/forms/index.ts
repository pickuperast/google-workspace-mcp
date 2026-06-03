import type { FastMCP } from 'fastmcp';
import { register as addFormQuestion } from './addFormQuestion.js';
import { register as createForm } from './createForm.js';
import { register as getForm } from './getForm.js';
import { register as getFormResponse } from './getFormResponse.js';
import { register as listFormResponses } from './listFormResponses.js';
import { register as listForms } from './listForms.js';
import { register as setFormPublishSettings } from './setFormPublishSettings.js';
import { register as updateFormInfo } from './updateFormInfo.js';

export function registerFormsTools(server: FastMCP) {
  createForm(server);
  listForms(server);
  getForm(server);
  updateFormInfo(server);
  addFormQuestion(server);
  setFormPublishSettings(server);
  listFormResponses(server);
  getFormResponse(server);
}
