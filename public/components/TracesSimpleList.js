import html from "solid-js/html";
import { TimeAgo } from "./TimeAgo.js";

export const TracesSimpleList = (props) => {
    const handleTraceClick = (traceId) => {
        props.onTraceSelect(traceId);
    };

    return html`
        <div class="border-t border-gray-300 pt-3 flex-1 overflow-auto">
            <h3 class="text-sm font-medium text-gray-600 mb-2">
                📋 多轮对话 (${() => props.filteredTraces().length})
            </h3>

            ${() =>
                props.traces.loading &&
                html`
                    <div class="text-center text-gray-500 py-2">
                        <div
                            class="inline-block w-4 h-4 border border-gray-300 border-t-green-600 rounded-full animate-spin"
                        ></div>
                        <span class="ml-1 text-xs">加载中...</span>
                    </div>
                `}
            ${() =>
                props.traces.error
                    ? html`
                          <div class="text-red-500 text-center py-2">
                              <p class="text-xs">${props.traces.error}</p>
                              <button
                                  onclick=${props.onLoadTraces}
                                  class="mt-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                              >
                                  重试
                              </button>
                          </div>
                      `
                    : ""}
            ${() =>
                !props.traces.loading &&
                !props.traces.error &&
                props.filteredTraces().length === 0
                    ? html`
                          <div class="text-center text-gray-500 py-2">
                              <p class="text-xs">暂无traces</p>
                          </div>
                      `
                    : ""}
            ${() =>
                !props.traces.loading &&
                !props.traces.error &&
                props.filteredTraces().length > 0
                    ? html`
                          <div class="space-y-1">
                              ${[...props.filteredTraces()]
                                  .reverse()
                                  .map((trace, index) => {
                                      const panelCard = () => {
                                          const isSelected =
                                              props.selectedTraceId() ===
                                              trace.trace_id;
                                          return `trace-item card-hover py-1 px-2 m-2  bg-white border-2  rounded-lg cursor-pointer ${
                                              isSelected
                                                  ? "border-blue-500"
                                                  : "border-gray-200"
                                          }`;
                                      };
                                      return html`
                                          <div
                                              onclick=${() =>
                                                  handleTraceClick(
                                                      trace.trace_id,
                                                  )}
                                              class=${panelCard()}
                                          >
                                              <div
                                                  class="flex items-center justify-between"
                                              >
                                                  <span
                                                      class="font-mono text-gray-700 truncate"
                                                  >
                                                      Run ${index + 1}:
                                                      ${trace.trace_id}
                                                  </span>
                                              </div>
                                              <div class="mt-0.5">
                                                  ${TimeAgo({
                                                      datetime: parseInt(
                                                          trace.last_run_time,
                                                      ),
                                                      class: "text-gray-400 text-xs",
                                                  })}

                                                  <span
                                                      class="whitespace-nowrap inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full mr-1 font-mono"
                                                  >
                                                      ${"🪙 " +
                                                      (trace.total_tokens_sum ||
                                                          0)}
                                                  </span>
                                                  <span
                                                      class="whitespace-nowrap inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-mono"
                                                  >
                                                      ${"⏱️ " +
                                                      formatDuration(
                                                          new Date(
                                                              parseInt(
                                                                  trace.last_run_time,
                                                              ),
                                                          ).getTime() -
                                                              new Date(
                                                                  parseInt(
                                                                      trace.first_run_time,
                                                                  ),
                                                              ).getTime(),
                                                      )}
                                                  </span>
                                                  <span
                                                      class="whitespace-nowrap inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono ml-1"
                                                      title="用户ID"
                                                  >
                                                      👤 ${trace.user_id}
                                                  </span>
                                              </div>
                                          </div>
                                      `;
                                  })}
                          </div>
                      `
                    : ""}
        </div>
    `;
};

export const formatDuration = (duration) => {
    if (duration < 1000) return "0.0s";
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = (duration % 60000) / 1000;
    let result = [];
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0 || hours > 0) result.push(`${minutes}m`);
    result.push(`${seconds.toFixed(1)}s`);
    return result.join(" ");
};
