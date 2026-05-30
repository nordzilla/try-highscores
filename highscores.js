function numberWithCommas(x) {
    return new Intl.NumberFormat().format(x.toFixed(0));
}

function numberWithDecimals(x) {
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    }).format(x);
}

function formatDate(d) {
    return new Date(d).toLocaleString();
}

function tryLink(a) {
    return `https://treeherder.mozilla.org/#/jobs?repo=try&author=${a}`;
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => b[i] === v);
}

function doSplash() {
    document.querySelector("body").style.visibility = "hidden";
    document.querySelector("html").className = "splash";

    setTimeout(function() {
        document.querySelector("body").style.visibility = "visible";
        document.querySelector("html").className = "";
        setTimeout(doSplash, 60000);
    }, 5000);
}

let gKeys = [];
let gIsSplashing = false;
function onKeyDown(e) {
    gKeys.push(e.key);
    gKeys = gKeys.slice(-11);
    if (arraysEqual(gKeys, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a", "Enter"])) {
        if (!gIsSplashing) {
            doSplash();
            gIsSplashing = true;
        }
    }
}

async function getScores() {
    const response = await fetch("https://sql.telemetry.mozilla.org/api/queries/47423/results.json?api_key=WKtQzeAXITaZl2ZDfPKlwrWyccAbiLhXafLxKV5G");
    const responseJson = await response.json();
    const raw_rows = responseJson.query_result.data.rows;
    let rows_by_author = {};
    for (let row of raw_rows) {
        if (!rows_by_author.hasOwnProperty(row.author)) {
            rows_by_author[row.author] = {
                author: row.author,
                elapsed: 0,
                jobs: 0,
            }
        }
        rows_by_author[row.author].elapsed += row.elapsed;
        rows_by_author[row.author].jobs += row.jobs;
    }
    const rows = Object.values(rows_by_author)
      .sort((a, b) => b.elapsed - a.elapsed);
    return {
        rows: rows,
        queryTime: responseJson.query_result.retrieved_at,
    };
}

class UserRow extends React.Component {
    render() {
        const hoursPerJob = this.props.jobs ? this.props.hours / this.props.jobs : 0;
        return [
            <span key="rank" className="rank">{this.props.rank}</span>,
            <span key="user" className="user"><a href={tryLink(this.props.author)} target="_new">{this.props.author}</a></span>,
            <span key="hours" className="hours">{numberWithCommas(this.props.hours)}</span>,
            <span key="jobs" className="jobs">{numberWithCommas(this.props.jobs)}</span>,
            <span key="hours-per-job" className="hours-per-job">{numberWithDecimals(hoursPerJob)}</span>,
        ];
    }
}

class HighscoresTable extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            rows: [],
            queryTime: new Date(),
            sortColumn: "hours",
            sortDirection: "desc",
        };
        this.setSort = this.setSort.bind(this);
    }

    setSort(sortColumn) {
        const sortDirection = this.state.sortColumn === sortColumn && this.state.sortDirection === "desc" ? "asc" : "desc";
        this.setState({
            sortColumn: sortColumn,
            sortDirection: sortDirection,
        });
    }

    sortValue(row) {
        if (this.state.sortColumn === "hours") {
            return row.elapsed / 3600;
        }
        if (this.state.sortColumn === "jobs") {
            return row.jobs;
        }
        return row.jobs ? (row.elapsed / 3600) / row.jobs : 0;
    }

    sortedRows() {
        const direction = this.state.sortDirection === "asc" ? 1 : -1;
        return this.state.rows.slice().sort((a, b) => {
            const difference = this.sortValue(a) - this.sortValue(b);
            if (difference !== 0) {
                return difference * direction;
            }
            return b.elapsed - a.elapsed;
        });
    }

    sortableHeader(className, sortColumn, label) {
        const sortMarker = this.state.sortColumn === sortColumn ? (this.state.sortDirection === "asc" ? "↑" : "↓") : "";
        return (
            <span
                className={`${className} sortable`}
                onClick={() => this.setSort(sortColumn)}
                onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        this.setSort(sortColumn);
                    }
                }}
                role="button"
                tabIndex="0">
                {label}
                <i className="sort-marker">{sortMarker}</i>
            </span>
        );
    }

    render() {
        const sortedRows = this.sortedRows();
        return (
            <div>
                <div id="scores">
                    <span className="rank">Rank</span>
                    <span className="user">User</span>
                    {this.sortableHeader("hours", "hours", "Hours")}
                    {this.sortableHeader("jobs", "jobs", "Jobs")}
                    {this.sortableHeader("hours-per-job", "hoursPerJob", "Hr/Job")}
                    {sortedRows.map((row, index) =>
                        <UserRow
                            key={row.author}
                            rank={this.state.sortDirection === "asc" ? sortedRows.length - index : index + 1}
                            author={row.author}
                            hours={row.elapsed / 3600}
                            jobs={row.jobs} />
                    )}
                </div>
                <div id="footer">
                    <a href="https://sql.telemetry.mozilla.org/queries/47423">Report</a> generated at {formatDate(this.state.queryTime)} for try pushes in the previous 7 days.
                </div>
            </div>
        );
    }

    async componentDidMount() {
        document.getElementById("root").focus();
        const result = await getScores();
        this.setState({
          ...result
        });
    }
}

ReactDOM.render(
    (
        <div>
            <div id="title">Try High Scores</div>
            <HighscoresTable />
        </div>
    ),
    document.getElementById("root")
);
window.addEventListener("keydown", onKeyDown);
