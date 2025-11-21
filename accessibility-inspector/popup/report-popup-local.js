var currentReport = null;
var currentSelectedFormat = "html";


const selectAsFormatIn = document.getElementById("selectAsFormatIn");
const downloadAsFormat = document.getElementById("downloadAsFormat");
const contentHTML = document.getElementById("report--content--html");
const formatSelectedPreviewContainers = {
    "html": document.getElementById("report--content--html"),
    "markdown": document.getElementById("report--content--markdown"),
    "json": document.getElementById("report-content--json")
};

function downloadAsHTML(reportData){
    
    const styles = `
    body{
    font-size: 1rem;
}

code {
  background-color: #f4f4f4;
  color: #d63384;
  padding: 0.8em;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 0.875em;
  border: 1px solid #e1e1e1;
}

.about__list{
    margin-left: 1rem;
}

.about__list_item {
    display: flex;
    flex-direction: row;
    align-items: baseline;
}

.about__list_item strong {
    margin-right: 1rem;
}

.issuses__controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-left: 1rem;
    margin-bottom: 1rem;
}

.issuses__controls__selector {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: -webkit-fill-available;
}

.issuses__controls__buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: -webkit-fill-available;  
    margin-top: 0.5rem;
}

.issuses__controls__buttons__filters {
    display: flex;
    flex-direction: row;
    align-items: center;
    /* width: 200%; */
    justify-content: space-between;
}
.issuses__controls__buttons__filters button {
    margin-left: 1rem;
}

#issuses__list{
    margin-left: 1rem;
}

.issuses__list__details {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background-color: #fff;
    background-clip: border-box;
    border: 1px solid rgba(0, 0, 0, .125);
    border-radius: .25rem;
    margin-bottom: .5rem;
}

.issuses__list__details summary {
    /*display: flex;*/
    cursor: pointer;
    padding: .75rem 1.25rem;
    margin-bottom: 0;
    
    border-bottom: 1px solid rgba(0, 0, 0, .125);
    flex-direction: row;
    justify-content: space-between;
}

.issuses__list__details__summary__issuse__default {
    background-color: #1a73e8;
    color: #ffffff;
}

.issuses__list__details__summary__issuse__warnign {
    background-color: #f9ab00;
}

.issuses__list__details__summary__issuse__error {
    background-color: #d93025;
    color: #ffffff;
}

.issuses__list__details__title {
    display: inline-flex;
    width: 98%;
    flex-direction: row;
    justify-content: space-between;
}

.issuses__list__details__container {
    margin: 1.2rem; 
    display: flex;
    flex-direction: column;
}
.hidden {
    display: none;
}


/* Primary button */
.primary-btn {
  padding: 0.4rem;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-btn:hover {
  background-color: #1669d9;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Secondary button */
.secondary-btn {
  padding: 0.4rem;
  background-color: #ffffff;
  color: #1a73e8;
  border: 1px solid #dadce0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s;
}

.secondary-btn:hover {
  background-color: #f8f9fa;
  border-color: #1a73e8;
}

select{
    width: 15rem;
    height: 2rem;
    margin-bottom: .25rem;
    margin-top: .25rem;
    border: solid 1px #c7ccd1;
    border-radius: 5px;
    transition: all 0.2s ease-out;
    cursor: pointer;
}
select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

select option {
  padding: 10px;
  background-color: white;
  color: #333;
}

select option:hover {
  background-color: #f0f0f0;
}

select option:checked {
  background-color: #d93025;
  color: white;
}
.menu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}
.menu__download {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
}
#selectAsFormatIn {
    margin-right: 1rem;
}
    `;
    const script = 
    `
    var isAllIssusesElementsExpanded = true;

const popupBodyReport = document.getElementById("popup-body-report");

const summaryUrl = document.getElementById("summary--about--showurl");
const summaryDatetime = document.getElementById("summary--about--showdatetime");
const summaryTotalIssuses = document.getElementById("summary--about--total");
const summaryWarnings = document.getElementById("summary--about--warnings");
const summaryErrors = document.getElementById("summary--about--errors");

const selectorByIssuseTypes = document.getElementById("selector-by-issuse-types");
const selectorByCategories = document.getElementById("selector-by-categorys");
const btnAcceptFilters = document.getElementById("btn-accept-filters");
const btnResetFilters = document.getElementById("btn-reset-filters");
const btnExpandIssuses = document.getElementById("btn-expand-issuses");




function generateIssuse(position, issuse){
    /* Создает развертывающийся виджет для единичной проблемы */
    const cnt_category = Object.hasOwn(issuse, "category") ? issuse.category : "Категория не указана";
    const cnt_element = Object.hasOwn(issuse, "element") ? issuse.element : null;
    const cnt_message = (Object.hasOwn(issuse, "message") ? issuse.message : "Сообщение отсутсвует");
    const cnt_selector = Object.hasOwn(issuse, "selector") ? issuse.selector : null;
    const cnt_type = Object.hasOwn(issuse, "type") ? issuse.type : "Не указано";

    let details = document.createElement("details");
    details.setAttribute("data-category", cnt_category);
    details.setAttribute("data-issuse-type", cnt_type);
    details.classList.add("issuses__list__details");
    details.id = "issuses__list__issuse__" + position;
    let summary = document.createElement("summary");
    summary.classList.add("issuses__list__details__summary__issuses");
    switch (cnt_type) {
        case "error":
            summary.classList.add("issuses__list__details__summary__issuse__error");
            break;
        case "warning":
            summary.classList.add("issuses__list__details__summary__issuse__warnign");
            break;
        default:
            summary.classList.add("issuses__list__details__summary__issuse__default");
            break;
    }
    let summary_container = document.createElement("span");
    summary_container.classList.add("issuses__list__details__title");
    let category_span = document.createElement("span");
    category_span.innerHTML = position + ": <strong>Category</strong>: " + cnt_category;
    let span_issuse_type = document.createElement("span");
    span_issuse_type.innerText = cnt_type;
    summary_container.appendChild(category_span);
    summary_container.appendChild(span_issuse_type);
    summary.appendChild(summary_container);
    details.appendChild(summary);

    let details_containet = document.createElement("div");
    details_containet.classList.add("issuses__list__details__container");
    let p_category = document.createElement("p");
    p_category.innerHTML = "<strong>Message</strong>: " + cnt_message;
    details_containet.appendChild(p_category);

    if (cnt_selector){
        let p_selector = document.createElement("p");
        p_selector.innerHTML = "<strong>Selector</strong>: " + cnt_selector;
        details_containet.appendChild(p_selector);
    }
    if (cnt_element){
        let label_for_element_code = document.createElement("p");
        label_for_element_code.innerHTML = "<strong>Element code</strong>:";
        details_containet.appendChild(label_for_element_code);
        let element_code = document.createElement("code");
        element_code.innerText = cnt_element;
        details_containet.appendChild(element_code);
    }
    
    details.appendChild(details_containet);

    return details;
}

function showDetailsIssuses(issuses){
    const issusesList = document.getElementById("issuses__list");
    issuses.forEach((element, i) => {
        issusesList.appendChild(generateIssuse(i, element));
    });

}

function getReportAsHTML(){
}

function initSelectorsForSorting(issusesElements){
    let issuseTypes = new Set([...issusesElements].map((item) => item.getAttribute("data-issuse-type")));
    issuseTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = item;
        opt.value = item;
        selectorByIssuseTypes.appendChild(opt);
    });
    let categoryTypes = new Set([...issusesElements].map((item) => item.getAttribute("data-category")));
    categoryTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = item;
        opt.value = item;
        selectorByCategories.appendChild(opt);
    });
}

function checkIsAllExpanedElements(elements){
    let isAllExpanded = true;
    [...elements].forEach(item => {
        if (item.hasAttribute("open")){
            isAllExpanded = false;
        }
    });
    return isAllExpanded;     
}

function init(reportData){
    summaryUrl.innerText = reportData.url;
    summaryUrl.setAttribute("href", reportData.url);
    summaryDatetime.innerText = (new Date(reportData.timestamp)).toLocaleString('ru-RU');
    summaryTotalIssuses.innerText = reportData.summary.total;
    summaryWarnings.innerText = reportData.summary.warnings;
    summaryErrors.innerText = reportData.summary.errors;
    showDetailsIssuses(reportData.issues);

    const issusesElements = document.getElementsByClassName("issuses__list__details");
    [...issusesElements].forEach(item => {
        item.addEventListener("click", function() {
            setTimeout(() => {
                isAllIssusesElementsExpanded = checkIsAllExpanedElements(issusesElements);
                btnExpandIssuses.innerText = isAllIssusesElementsExpanded ? "Expand all" : "Hide All";
            }, 5)
            
        })
    });

    initSelectorsForSorting(issusesElements);

    btnAcceptFilters.addEventListener("click", function() {
        let filtersElements = [...issusesElements];
        let categoryValue = selectorByCategories.value;
        let issuseTypeValue = selectorByIssuseTypes.value;
        filtersElements.forEach((item) => {
            item.classList.add("hidden");
        });
        if (categoryValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-category") === categoryValue
            );
        }
        if (issuseTypeValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-issuse-type") === issuseTypeValue
            );
        }
        filtersElements.forEach((item) => {
            item.classList.remove("hidden");
        });
    });
    btnResetFilters.addEventListener("click", function() {
        let filtersElements = [...issusesElements];
        filtersElements.forEach(item => {
            item.classList.remove("hidden");
        })
        selectorByCategories.value = "null";
        selectorByIssuseTypes.value = "null";
    });
    btnExpandIssuses.addEventListener("click", function() {
        [...issusesElements].forEach(item => {
            item.toggleAttribute("open", isAllIssusesElementsExpanded);
        });
        isAllIssusesElementsExpanded = !isAllIssusesElementsExpanded;
        btnExpandIssuses.innerText = isAllIssusesElementsExpanded ? "Expand all" : "Hide All";
    });   
}
    `;
    
    const pageWithHTML = `
    <!DOCTYPE html>
<html lang="ru">
<head>
    <title>Отчет</title>
    <meta charset="utf-8">
    <style>${styles}</style>
</head>
<body id="popup-body-report">
        <header class="summary">
            <h2 class="sumarry__title">Общее</h1>
            <div class="about__list">
                <div class="about__list_item">
                    <strong>Сайт: </strong>
                    <a id="summary--about--showurl"></a>
                </div>
                <div class="about__list_item">
                    <strong>Дата отчета: </strong>
                    <p id="summary--about--showdatetime"></p>
                </div>
                <div class="about__list_item">
                    <strong>Всего проблем: </strong>
                    <p id="summary--about--total">0</p>
                </div>
                <div class="about__list_item">
                    <strong>Предупреждений: </strong>
                    <p id="summary--about--warnings">0</p>
                </div>
                <span class="about__list_item">
                    <strong>Ошибок: </strong>
                    <p id="summary--about--errors">0</p>
                </div>
            </div>
        </header>
        <main>
            <h2>Подробности</h2>
            <div class="issuses__controls">
                <div class="issuses__controls__selector">
                    <label for="selector-by-issuse-types">By issuse types</label>
                    <select id="selector-by-issuse-types">
                        <option value="null"> -- Not selected --</option>
                    </select>
                </div>
                <div class="issuses__controls__selector">
                    <label for="selector-by-categorys">By category</label>
                    <select id="selector-by-categorys">
                        <option value="null"> -- Not selected --</option>
                    </select>
                </div>
                <div class="issuses__controls__buttons">

                    <button class="primary-btn" id="btn-expand-issuses">Expand all</button>
                    <div class="issuses__controls__buttons__filters">
                        <button class="secondary-btn" id="btn-reset-filters">Reset filters</button>
                        <button class="primary-btn" id="btn-accept-filters">Accept filters</button>
                    </div>
                </div>
            </div>
            <div id="issuses__list"></div>
        </main>
        <script>let currentReport = ${JSON.stringify(reportData)};</script>
        <script>${script}</script>
        <script>init(currentReport);</script>
</body>
</html>
    `
    const date = (new Date(reportData.timestamp)).toLocaleString('ru-RU');
    const formatter = date.replace(".", '_').replace(".", '_').replace(" ", '_').replace(",", "_").replace(":", "_"); 
    downloadFile(pageWithHTML, "report_" + formatter + ".html");
}

function downloadAsJSON(reportData){
    const fileContent = JSON.stringify(reportData, true, 4);
    const date = (new Date(reportData.timestamp)).toLocaleString('ru-RU');
    const formatter = date.replace(".", '_').replace(".", '_').replace(" ", '_').replace(",", "_").replace(":", "_"); 
    downloadFile(fileContent, "report_" + formatter + ".json");
}


function downloadFile(fileContent, fileName, fileType="text/plain"){
    const blob = new Blob([fileContent], { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showInJsonFormat(reportData){
    let container = document.getElementById("report-content--json--preview");
    container.innerText = JSON.stringify(reportData, true, 4);
}



document.addEventListener('DOMContentLoaded', function() {
    
    chrome.storage.local.get("currentReport", (result) => {
        currentReport = result.currentReport;
        init(currentReport);
        showInJsonFormat(currentReport);
    });
    
    downloadAsFormat.addEventListener("click", function() {
        switch (currentSelectedFormat) {
            case "html":
                downloadAsHTML(currentReport);
                break;
            case "json":
                downloadAsJSON(currentReport);
                break;
        }
        
    });
    selectAsFormatIn.addEventListener("change", function() {
        currentSelectedFormat = selectAsFormatIn.value;
        [...Object.values(formatSelectedPreviewContainers)].forEach((item) => {
            item.hidden = true;
            console.log(item);
        })
        switch (currentSelectedFormat) {
            case "html":
                formatSelectedPreviewContainers["html"].hidden = false;
                break;
            case "markdown":
                formatSelectedPreviewContainers["markdown"].hidden = false;
                break;
            case "json":
                formatSelectedPreviewContainers["json"].hidden = false;
                break;
            default:
                formatSelectedPreviewContainers["html"].hidden = false;
                break;
        }
    });
});
