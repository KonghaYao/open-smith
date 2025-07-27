export const Table = (props: {
    columnsConfig: any[];
    data: any[];
    onRowClick: (row: any) => void;
    loading: boolean;
    error: any;
}) => {
    return (
        <div class="bg-white shadow rounded-lg p-4 flex-1 overflow-auto flex flex-col">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">
                Runs Details
            </h2>
            {props.loading ? (
                <p>Loading runs data...</p>
            ) : props.error ? (
                <p class="text-red-500">
                    Error loading runs: {props.error.message}
                </p>
            ) : props.data && props.data.length > 0 ? (
                <div class="overflow-x-auto flex-1">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                {props.columnsConfig.map((col, idx) => (
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {props.data.map((row, rowIdx) => (
                                <tr
                                    class="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => props.onRowClick(row)}>
                                    {props.columnsConfig.map((col, colIdx) => (
                                        <td class={col.class}>
                                            {col.format
                                                ? col.format(row)
                                                : Array.isArray(col.key)
                                                ? col.key
                                                      .map((k) => row[k])
                                                      .join(" ")
                                                : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p class="text-gray-500">No runs data available.</p>
            )}
        </div>
    );
};
