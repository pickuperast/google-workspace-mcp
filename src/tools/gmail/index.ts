import type { FastMCP } from 'fastmcp';
import { register as applyLabelToMessageOrThread } from './applyLabelToMessageOrThread.js';
import { register as applyLabelsToDraft } from './applyLabelsToDraft.js';
import { register as createOrUpdateDraftByThread } from './createOrUpdateDraftByThread.js';
import { register as createDraft } from './createDraft.js';
import { register as deleteDraft } from './deleteDraft.js';
import { register as getEmail } from './getEmail.js';
import { register as getDraftRaw } from './getDraftRaw.js';
import { register as getThread } from './getThread.js';
import { register as listEmails } from './listEmails.js';
import { register as listGmailLabels } from './listGmailLabels.js';
import { register as markDraftAsApproved } from './markDraftAsApproved.js';
import { register as previewDraftRendering } from './previewDraftRendering.js';
import { register as removeLabelsFromDraft } from './removeLabelsFromDraft.js';
import { register as sendDraft } from './sendDraft.js';
import { register as sendDraftBatch } from './sendDraftBatch.js';
import { register as sendEmail } from './sendEmail.js';
import { register as updateDraft } from './updateDraft.js';

export function registerGmailTools(server: FastMCP) {
  listGmailLabels(server);
  listEmails(server);
  getEmail(server);
  getThread(server);
  createDraft(server);
  createOrUpdateDraftByThread(server);
  updateDraft(server);
  deleteDraft(server);
  getDraftRaw(server);
  previewDraftRendering(server);
  applyLabelsToDraft(server);
  removeLabelsFromDraft(server);
  markDraftAsApproved(server);
  sendDraft(server);
  sendDraftBatch(server);
  sendEmail(server);
  applyLabelToMessageOrThread(server);
}
