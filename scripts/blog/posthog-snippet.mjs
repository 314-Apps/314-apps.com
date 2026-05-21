/**
 * PostHog snippet used by build-site.mjs to instrument every static HTML page
 * in _site/ (excluding /blog-admin/). The project public token is safe to ship
 * client-side; restrictions live on the PostHog project itself.
 *
 * Project: Inventr (314 Apps) — US Cloud.
 *
 * person_profiles: 'identified_only' keeps anonymous traffic from creating
 * person profiles, which preserves quota for actual identified users.
 */
export const POSTHOG_PROJECT_KEY = 'phc_CXPWbeXEJRppcYhrg2SpA2ySBKCQrxVPmPhqcvbive2z';
export const POSTHOG_API_HOST = 'https://us.i.posthog.com';

export const POSTHOG_SNIPPET = `<!-- PostHog Web Analytics (Inventr, US Cloud) -->
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('${POSTHOG_PROJECT_KEY}', {
    api_host: '${POSTHOG_API_HOST}',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true
  });
</script>
`;

const INJECT_MARKER = '<!-- PostHog Web Analytics (Inventr, US Cloud) -->';

/**
 * Inject the PostHog snippet immediately before </head> in the given HTML
 * source. Idempotent: if the snippet is already present, the original string
 * is returned unchanged. If the document has no </head>, the source is
 * returned unchanged so we never corrupt non-HTML or partial fragments.
 */
export function injectPosthogSnippet(html) {
  if (typeof html !== 'string') return html;
  if (html.includes(INJECT_MARKER)) return html;
  const headCloseRe = /<\/head>/i;
  if (!headCloseRe.test(html)) return html;
  return html.replace(headCloseRe, `${POSTHOG_SNIPPET}</head>`);
}
