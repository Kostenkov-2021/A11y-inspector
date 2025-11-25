/*
    * Использует Marked.js (https://github.com/markedjs/marked)
*/

var currentReport = null;
var currentSelectedFormat = "html";
let _currentReportAsMarkdown = "";


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

.issues__controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-left: 1rem;
    margin-bottom: 1rem;
}

.issues__controls__selector {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: -webkit-fill-available;
}

.issues__controls__buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: -webkit-fill-available;  
    margin-top: 0.5rem;
}

.issues__controls__buttons__filters {
    display: flex;
    flex-direction: row;
    align-items: center;
    /* width: 200%; */
    justify-content: space-between;
}
.issues__controls__buttons__filters button {
    margin-left: 1rem;
}

#issues__list{
    margin-left: 1rem;
}

.issues__list__details {
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

.issues__list__details summary {
    /*display: flex;*/
    cursor: pointer;
    padding: .75rem 1.25rem;
    margin-bottom: 0;
    
    border-bottom: 1px solid rgba(0, 0, 0, .125);
    flex-direction: row;
    justify-content: space-between;
}

.issues__list__details__summary__issuse__default {
    background-color: #1a73e8;
    color: #ffffff;
}

.issues__list__details__summary__issuse__warnign {
    background-color: #f9ab00;
}

.issues__list__details__summary__issuse__error {
    background-color: #d93025;
    color: #ffffff;
}

.issues__list__details__title {
    display: inline-flex;
    width: 98%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}
.issues__list__details__title h3 {
    margin: .3rem;
}
.issues__list__details__code {
    background-color: #f4f4f4;
    color: #d63384;
    padding: 0.8em;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 0.875em;
    border: 1px solid #e1e1e1;
    margin-bottom: .5rem;
}

.issues__list__details__container {
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
    padding-bottom: 0.5rem;
    border-bottom: 1px black solid;
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

#report-content--json {
    width: 100%;
}

#report-content--json pre {
    max-width: 95%;
    white-space: break-spaces;
}

#report-content--json pre code {
    display: flex;
}

#report--content--markdown--preview {
    display: flex;
    flex-direction: column;
    align-items: stretch;
}

#report--content--markdown--preview code {
    display: flex;
    background-color: #f4f4f4;
    color: #d63384;
    padding: 0.1rem;
    margin: .2rem;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 0.875em;
    border: 1px solid #e1e1e1;
    white-space: break-spaces;
}

#report--content--markdown--preview hr {
    width: -webkit-fill-available;
}

.issues__list__details__color__container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

.issues__list__details__color__container__show {
    width: 1rem;
    height: 1rem;
    border: .1rem solid;
    margin-left: 1rem;
}
    `;
    const script = `
    var isAllissuesElementsExpanded = true;

const popupBodyReport = document.getElementById("popup-body-report");

const summaryUrl = document.getElementById("summary--about--showurl");
const summaryDatetime = document.getElementById("summary--about--showdatetime");
const summaryTotalissues = document.getElementById("summary--about--total");
const summaryWarnings = document.getElementById("summary--about--warnings");
const summaryErrors = document.getElementById("summary--about--errors");

const selectorByIssuesTypes = document.getElementById("selector-by-issues-types");
const selectorByCategories = document.getElementById("selector-by-categorys");
const btnAcceptFilters = document.getElementById("btn-accept-filters");
const btnResetFilters = document.getElementById("btn-reset-filters");
const btnExpandissues = document.getElementById("btn-expand-issues");


function createPairConstructElement(title, value, colorValue){
    let colorDiv = document.createElement("div");
    colorDiv.classList.add("issues__list__details__color__container");
    let titltColor = document.createElement("strong");
    titltColor.innerText = title + (value ? ": " : "");
    colorDiv.appendChild(titltColor);
    if (value){
        let valueContainer = document.createElement("span");
        valueContainer.style = "display: inline-flex;flex-direction: row;align-items: center;"
        let valueShowed = document.createElement("p");
        valueShowed.innerText = value;
        valueContainer.appendChild(valueShowed);
        if (colorValue){
            let colorShowed = document.createElement("div");
            colorShowed.classList.add("issues__list__details__color__container__show");
            colorShowed.style.backgroundColor = colorValue;
            valueContainer.appendChild(colorShowed);
        }
        colorDiv.appendChild(valueContainer);
    }
    return colorDiv;
}



function generateIssues(position, issues){
    /* Создает развертывающийся виджет для единичной проблемы */
    const cnt_category = Object.hasOwn(issues, "category") ? issues.category : "Категория не указана";
    const cnt_element = Object.hasOwn(issues, "element") ? issues.element : null;
    const cnt_message = (Object.hasOwn(issues, "message") ? issues.message : "Сообщение отсутсвует");
    const cnt_selector = Object.hasOwn(issues, "selector") ? issues.selector : null;
    const cnt_type = Object.hasOwn(issues, "type") ? issues.type : "Не указано";

    let details = document.createElement("details");
    details.setAttribute("data-category", cnt_category);
    details.setAttribute("data-issues-type", cnt_type);
    details.classList.add("issues__list__details");
    details.id = "issues__list__issues__" + position;
    let summary = document.createElement("summary");
    summary.classList.add("issues__list__details__summary__issues");
    switch (cnt_type) {
        case "error":
            summary.classList.add("issues__list__details__summary__issues__error");
            break;
        case "warning":
            summary.classList.add("issues__list__details__summary__issues__warning");
            break;
        default:
            summary.classList.add("issues__list__details__summary__issues__default");
            break;
    }
    let summary_container = document.createElement("span");
    summary_container.classList.add("issues__list__details__title");
    let category_span = document.createElement("h3");
    category_span.innerHTML = "Issue: " + position + " > <strong>Category</strong>: " + cnt_category;
    let span_issues_type = document.createElement("span");
    span_issues_type.innerText = cnt_type;
    summary_container.appendChild(category_span);
    summary_container.appendChild(span_issues_type);
    summary.appendChild(summary_container);
    details.appendChild(summary);

    led details_contained = document.createElement("div");

    if (cnt_selector){
        details_contained.appendChild(createPairConstructElement("Selector", cnt_selector));
    }

    details_contained.classList.add("issues__list__details__container");
    let p_message_title = document.createElement("strong");
    p_message_title.innerText = "Message:";
    details_contained.appendChild(p_message_title);
    let p_message_text = document.createElement("p")
    p_message_text.innerText = cnt_message;
    details_contained.appendChild(p_message_text);
    
    if (cnt_element){
        let label_for_element_code = document.createElement("p");
        label_for_element_code.innerHTML = "<strong>Element code</strong>:";
        details_contained.appendChild(label_for_element_code);
        let element_code = document.createElement("code");
        element_code.classList.add("issues__list__details__code");
        element_code.innerText = cnt_element;
        details_contained.appendChild(element_code);
    }
    

    if (cnt_category == "contrast"){
        let hrAfterCode = document.createElement("hr");
        hrAfterCode.style = "width: -webkit-fill-available;";
        details_contained.appendChild(hrAfterCode);
        details_contained.appendChild(createPairConstructElement("Contrast parameters"));

        let contrastParametersContainer = document.createElement("div");
        contrastParametersContainer.style = "margin-left: .7rem;"

        contrastParametersContainer.appendChild(createPairConstructElement(
            "Score", issues.details.suggestions.score
        ));

        contrastParametersContainer.appendChild(createPairConstructElement("Background element:"));

        let listBackColorShowed = document.createElement("ul");
        [
            createPairConstructElement(
                "backroundColor", issues.details.backgroundColor, issues.details.backgroundColor),
            createPairConstructElement(
                "textColor", issues.details.textColor, issues.details.textColor),
            createPairConstructElement(
                "fontSize", issues.details.fontSize),
            createPairConstructElement(
                "fontWeight", issues.details.fontWeight),
            createPairConstructElement(
                "ratio", issues.details.ratio),
            createPairConstructElement(
                "requiredRatio", issues.details.requiredRatio)
        ].forEach(item => {
            let itemShowed = document.createElement("li");
            itemShowed.appendChild(item);
            listBackColorShowed.appendChild(itemShowed);
        })
        contrastParametersContainer.appendChild(listBackColorShowed);
        details_containet.appendChild(contrastParametersContainer);

        

        if (issues.details.suggestions){
            contrastParametersContainer.appendChild(createPairConstructElement("Suggestions:"));

            let suggestionDiv = document.createElement("div");
            suggestionDiv.style = "margin-left: 1rem;"
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Improvement", issues.details.suggestions.improvement))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Current color", issues.details.suggestions.current, issues.details.suggestions.current))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Suggestion color", issues.details.suggestions.suggested, issues.details.suggestions.suggested))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Current ratio", issues.details.suggestions.currentRatio))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Suggestion ratio", issues.details.suggestions.suggestedRatio))
            contrastParametersContainer.appendChild(suggestionDiv);
        }
    }
    details.appendChild(details_contained);
    return details;
}

function showDetailsissues(issues){
    const issuesList = document.getElementById("issues__list");
    issues.forEach((element, i) => {
        issuesList.appendChild(generateIssues(i, element));
    });

}

function getReportAsHTML(){
}

function initSelectorsForSorting(issuesElements){
    let issuesTypes = new Set([...issuesElements].map((item) => item.getAttribute("data-issues-type")));
    issuesTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = item;
        opt.value = item;
        selectorByIssuesTypes.appendChild(opt);
    });
    let categoryTypes = new Set([...issuesElements].map((item) => item.getAttribute("data-category")));
    categoryTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = item;
        opt.value = item;
        selectorByCategories.appendChild(opt);
    });
}

function checkIsAllExpandedElements(elements){
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
    summaryTotalissues.innerText = reportData.summary.total;
    summaryWarnings.innerText = reportData.summary.warnings;
    summaryErrors.innerText = reportData.summary.errors;
    showDetailsissues(reportData.issues);

    const issuesElements = document.getElementsByClassName("issues__list__details");
    [...issuesElements].forEach(item => {
        item.addEventListener("click", function() {
            setTimeout(() => {
                isAllissuesElementsExpanded = checkIsAllExpandedElements(issuesElements);
                btnExpandissues.innerText = isAllissuesElementsExpanded ? "Expand all" : "Hide All";
            }, 5)
            
        })
    });

    initSelectorsForSorting(issuesElements);

    btnAcceptFilters.addEventListener("click", function() {
        let filtersElements = [...issuesElements];
        let categoryValue = selectorByCategories.value;
        let issuesTypeValue = selectorByIssuesTypes.value;
        filtersElements.forEach((item) => {
            item.classList.add("hidden");
        });
        if (categoryValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-category") === categoryValue
            );
        }
        if (issuesTypeValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-issues-type") === issuesTypeValue
            );
        }
        filtersElements.forEach((item) => {
            item.classList.remove("hidden");
        });
    });
    btnResetFilters.addEventListener("click", function() {
        let filtersElements = [...issuesElements];
        filtersElements.forEach(item => {
            item.classList.remove("hidden");
        })
        selectorByCategories.value = "null";
        selectorByIssuesTypes.value = "null";
    });
    btnExpandissues.addEventListener("click", function() {
        [...issuesElements].forEach(item => {
            item.toggleAttribute("open", isAllissuesElementsExpanded);
        });
        isAllissuesElementsExpanded = !isAllissuesElementsExpanded;
        btnExpandissues.innerText = isAllissuesElementsExpanded ? "Expand all" : "Hide All";
    });   
}
    `;
    
    const pageWithHTML = `
    <!DOCTYPE html>
<html lang="ru">
<head>
    <title>Отчёт</title>
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
                    <strong>Дата: </strong>
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
            <div class="issues__controls">
                <div class="issues__controls__selector">
                    <label for="selector-by-issues-types">By issues types</label>
                    <select id="selector-by-issues-types">
                        <option value="null"> -- Not selected --</option>
                    </select>
                </div>
                <div class="issues__controls__selector">
                    <label for="selector-by-categorys">By category</label>
                    <select id="selector-by-categorys">
                        <option value="null"> -- Not selected --</option>
                    </select>
                </div>
                <div class="issues__controls__buttons">

                    <button class="primary-btn" id="btn-expand-issues">Expand all</button>
                    <div class="issues__controls__buttons__filters">
                        <button class="secondary-btn" id="btn-reset-filters">Reset filters</button>
                        <button class="primary-btn" id="btn-accept-filters">Accept filters</button>
                    </div>
                </div>
            </div>
            <div id="issues__list"></div>
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

function downloadAsMARKDOWN(reportData){
    const date = (new Date(reportData.timestamp)).toLocaleString('ru-RU');
    const formatter = date.replace(".", '_').replace(".", '_').replace(" ", '_').replace(",", "_").replace(":", "_"); 
    downloadFile(_currentReportAsMarkdown, "report_" + formatter + ".md");
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

marked.setOptions({
    breaks: true,
    gfm: true
});


function parseReportAsMarkdwon(reportData){
    let _report = "# Отчет по доступности сайта\n";
    _report += "## Сводка\n\n";
    _report += "**Сайт:** " + reportData.url + "\n";
    _report += "**Время:** " + reportData.timestamp + "\n";
    _report += "**Всего проблем:** " + reportData.summary.total + "\n";
    _report += "**Предупреждений:** " + reportData.summary.warnings + "\n";
    _report += "**Ошибок:** " + reportData.summary.errors + "\n\n";
    _report += "## Детализация ошибок \n";
    reportData.issues.forEach((item, i) => {
        _report += "### **Issue:** " + i + "\n\n";
        _report += "**Type:** " + item.type + "\n";
        _report += "**Category**" + item.category + "\n"
        _report += "**Message:** " + item.message + "\n";
        _report += item.selector ? "**Selector:** " + item.selector + "\n" : "";
        _report += item.element ? "**Element code:**\n```\n" + item.element + "\n```\n" : "";
        if (item.category === "contrast"){
            _report += "#### Contrast parameters\n\n";
            _report += "**Score:** " + item.details.suggestions.score + "\n";
            _report += "**Improvement:** " + item.details.suggestions.improvement + "\n\n"
            _report += "##### Background info\n\n"
            _report += "**backgroundColor:** " + item.details.backgroundColor + "\n";
            _report += "**fontSize:** " + item.details.fontSize + "\n";
            _report += "**fontWeight:** " + item.details.fontWeight + "\n";
            _report += "**ratio:** " + item.details.ratio + "\n";
            _report += "**requiredRatio:** " + item.details.requiredRatio + "\n";
            _report += "**textColor:** " + item.details.textColor + "\n";
            _report += "##### Top element info\n\n";
            _report += "**Color:**\n";
            _report += " - **RGB:** " + item.details.suggestions.current + "\n";
            _report += " - **HEX:** " + item.details.suggestions.currentHex + "\n\n";
            _report += "**Ratio:** " + item.details.suggestions.currentRatio + "\n";
            _report += "##### Top element suggestions\n\n";
            _report += "**Suggested color:** \n";
            _report += " - **RGB:** " + item.details.suggestions.suggested + "\n";
            _report += " - **HEX:** " + item.details.suggestions.suggestedHex + "\n\n";
            _report += "**Ratio:** " + item.details.suggestions.suggestedRatio + "\n";
        }
        _report += "\n------------\n";
    });

    return _report;
}


function showInMarkdownFormat(reportData){
    _currentReportAsMarkdown = parseReportAsMarkdwon(reportData);
    const preview = document.getElementById("report--content--markdown--preview");
    const htmlText = marked.parse(_currentReportAsMarkdown);
    preview.innerHTML = htmlText;
}

document.addEventListener('DOMContentLoaded', function() {
    
    chrome.storage.local.get("currentReport", (result) => {
        currentReport = result.currentReport;
        init(currentReport);
        showInJsonFormat(currentReport);
        showInMarkdownFormat(currentReport);
    });
    
    downloadAsFormat.addEventListener("click", function() {
        switch (currentSelectedFormat) {
            case "html":
                downloadAsHTML(currentReport);
                break;
            case "json":
                downloadAsJSON(currentReport);
                break;
            case "markdown":
                downloadAsMARKDOWN(currentReport);
                break;
        }
        
    });
    selectAsFormatIn.addEventListener("change", function() {
        currentSelectedFormat = selectAsFormatIn.value;
        [...Object.values(formatSelectedPreviewContainers)].forEach((item) => {
            item.hidden = true;
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
