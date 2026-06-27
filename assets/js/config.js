/* Runtime config, shared across every page.
 *
 * SITE  — site-wide settings (base URL, monetization links).
 *         `tipJarUrl` is empty until the CEO picks a tip platform + handle;
 *         the tip-jar UI stays hidden while it is empty, so we never ship a
 *         broken "Buy me a coffee" link.
 *
 * ANALYTICS — the privacy-friendly beacon config. `token` is a public,
 *         INSERT-ONLY analytics key (the DB role it maps to can only append
 *         rows to page_views). Safe to ship. Each page sets ANALYTICS.tool
 *         itself (e.g. window.ANALYTICS.tool = "hub") before analytics.js runs.
 */
window.SITE = {
  baseUrl: "https://pockettempo.xyz",
  // Set this to a Ko-fi / Buy Me a Coffee / GitHub Sponsors / PayPal.me URL to
  // switch the tip jar live everywhere. Leave empty to hide it.
  tipJarUrl: ""
};

window.ANALYTICS = {
  endpoint: "https://ep-square-leaf-a6l5syhk.apirest.us-west-2.aws.neon.tech/neondb/rest/v1/page_views",
  token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFuYWx5dGljcy02OTdhN2FmOCJ9.eyJyb2xlIjoiYW5vbnltb3VzIiwic3ViIjoid2ViLWFub24iLCJpYXQiOjE3ODI0MzIwMDAsImV4cCI6MjA4Mjc1ODQwMH0.JgwYcark7kYMH-HQ6clyjED4ZY9IwfYL0LQIJAWL2pe2Q0Mt-RbGKtl33b_z4IOgfVtZhXPxKJMsZda6MZUvkbncItEakZOJvb_0h8sLnzCmbZcmIU69bnX3lSmlJHs_PP_cPCIXtUh1Fb_WayKcatR2oC_5FV-pYFRVV_TZ0LTo-DX-A7pRbPJgjNQaHzjmHlh42WvjQNMnZD3RgHR-Gfn5B0PFgHUK-xmqrbWFY8WqhfEdTyus8EKYk2bQrgkrBwvk5YuT-2Yfmlo0oUAgsmXKWG98Uw72P0Ape5Sb_L-F2PhD40Woq8KjROKcLkefPiNYkjkeyzZlwz7yKQqD8g"
};
