import html from "solid-js/html";

export const Table = (props) => {
    const { columnsConfig, data, onRowClick, loading, error } = props;

    return html`
        <div
            class="bg-white shadow rounded-lg p-4 flex-1 overflow-auto flex flex-col"
        >
            <h2 class="text-lg font-semibold text-gray-800 mb-4">
                Runs Details
            </h2>
            ${() =>
                loading
                    ? html`<p>Loading runs data...</p>`
                    : error
                    ? html`<p class="text-red-500">
                          Error loading runs: ${error.message}
                      </p>`
                    : data && data.length > 0
                    ? html`
                          <div class="overflow-x-auto flex-1">
                              <table
                                  class="min-w-full divide-y divide-gray-200"
                              >
                                  <thead class="bg-gray-50">
                                      <tr>
                                          ${() =>
                                              columnsConfig.map(
                                                  (col) => html`
                                                      <th
                                                          class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                      >
                                                          ${col.header}
                                                      </th>
                                                  `,
                                              )}
                                      </tr>
                                  </thead>
                                  <tbody
                                      class="bg-white divide-y divide-gray-200"
                                  >
                                      ${() =>
                                          data.map(
                                              (row) =>
                                                  html`
                                                      <tr
                                                          class="hover:bg-gray-50 cursor-pointer"
                                                          onclick=${() =>
                                                              onRowClick(row)}
                                                      >
                                                          ${() =>
                                                              columnsConfig.map(
                                                                  (col) => html`
                                                                      <td
                                                                          class=${col.className}
                                                                      >
                                                                          ${col.format
                                                                              ? col.format(
                                                                                    row,
                                                                                )
                                                                              : Array.isArray(
                                                                                    col.key,
                                                                                )
                                                                              ? col.key
                                                                                    .map(
                                                                                        (
                                                                                            k,
                                                                                        ) =>
                                                                                            row[
                                                                                                k
                                                                                            ],
                                                                                    )
                                                                                    .join(
                                                                                        " ",
                                                                                    )
                                                                              : row[
                                                                                    col
                                                                                        .key
                                                                                ]}
                                                                      </td>
                                                                  `,
                                                              )}
                                                      </tr>
                                                  `,
                                          )}
                                  </tbody>
                              </table>
                          </div>
                      `
                    : html`<p class="text-gray-500">
                          No runs data available.
                      </p>`}
        </div>
    `;
};
