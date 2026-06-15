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

function getGuideLinksForIssue(issue) {
    if (Array.isArray(issue?.guideLinks)) return issue.guideLinks;
    return typeof DokaGuideLinks !== "undefined" && typeof DokaGuideLinks.getLinks === "function"
        ? DokaGuideLinks.getLinks(issue)
        : [];
}

function prepareReportForStandalone(reportData) {
    if (!reportData) return reportData;
    return {
        ...reportData,
        issues: (reportData.issues || []).map(issue => ({
            ...issue,
            guideLinks: getGuideLinksForIssue(issue)
        }))
    };
}

function formatGuideLinksMarkdown(issue) {
    const links = getGuideLinksForIssue(issue);
    if (!links.length) return "";
    return "\n**\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:**\n" + links.map(link => `- [${link.title}](${link.url})\n`).join("");
}

function createDetailsListElement(details) {
    const entries = Object.entries(details || {});
    if (!entries.length) return null;

    const container = document.createElement("div");
    container.classList.add("issues__list__details__extra");
    const title = document.createElement("strong");
    title.innerText = "Подробности:";
    container.appendChild(title);

    const list = document.createElement("dl");
    entries.forEach(([key, value]) => {
        const term = document.createElement("dt");
        term.innerText = translateDetailKey(key) + ":";
        const description = document.createElement("dd");
        description.innerText = formatDetailValue(value, key);
        list.appendChild(term);
        list.appendChild(description);
    });

    container.appendChild(list);
    return container;
}

function formatDetailsMarkdown(details) {
    const entries = Object.entries(details || {});
    if (!entries.length) return "\n#### Подробности\n\nДополнительные сведения отсутствуют\n";
    return "\n#### Подробности\n\n" + entries.map(([key, value]) => `- **${translateDetailKey(key)}:** ${formatDetailValue(value, key)}\n`).join("");
}

function formatElementMarkdown(element) {
    const fence = String(element).includes("```") ? "````" : "```";
    return `**Код элемента:**\n${fence}\n${element}\n${fence}\n`;
}

function formatDetailValue(value, key = "") {
    if (value === null || value === undefined || value === "") return "не указано";
    if (Array.isArray(value)) return value.length ? value.map(item => formatDetailValue(item, key)).join("; ") : "нет данных";
    if (typeof value === "object") {
        return Object.entries(value)
            .map(([itemKey, itemValue]) => `${translateDetailKey(itemKey)}: ${formatDetailValue(itemValue, itemKey)}`)
            .join("; ");
    }
    if (typeof value === "boolean") return value ? "да" : "нет";
    if (["issue", "reason", "problem", "check"].includes(key)) return translateDetailCode(value);
    if (key === "improvement") return ({ darken: "сделать текст темнее", lighten: "сделать текст светлее", error: "не удалось подобрать улучшение" })[value] || String(value);
    return String(value);
}

function translateDetailCode(value) {
    return ({
        "required-field-without-instruction": "обязательное поле без инструкции",
        "broken-aria-describedby": "aria-describedby ссылается на несуществующий элемент",
        "broken-aria-errormessage": "aria-errormessage ссылается на несуществующий элемент",
        "visual-error-without-aria-invalid": "визуальная ошибка без aria-invalid",
        "invalid-field-without-error-description": "ошибочное поле без связанного описания ошибки",
        "invalid-field-without-correction-suggestion": "ошибочное поле без подсказки по исправлению",
        "input-constraint-without-instruction": "ограничение ввода без инструкции",
        "unassociated-error-message": "текст ошибки не связан с полем",
        "native-title-tooltip": "нативная подсказка title",
        "not-hoverable": "контент недоступен при наведении",
        "no-visible-dismiss": "нет видимого способа закрытия",
        "hover-only-trigger": "триггер доступен только при наведении",
        "controlled-popup-not-hoverable": "связанный всплывающий контент недоступен при наведении",
        "positive-tabindex": "положительный tabindex",
        "focus-moves-to-earlier-visual-row": "фокус переходит на визуально более раннюю строку",
        "focus-moves-backward-on-same-row": "фокус движется назад в той же визуальной строке",
        "potential-focus-trap-without-exit": "возможная клавиатурная ловушка без выхода",
        "tab-boundary-cancelled-without-exit": "Tab перехватывается на границе без выхода",
        "element-cancels-tab-both-directions": "элемент перехватывает Tab и Shift+Tab",
        "visible-label-not-in-accessible-name": "видимая метка не входит в доступное имя",
        "invalid-aria-live": "недопустимое значение aria-live",
        "invalid-aria-atomic": "недопустимое значение aria-atomic",
        "alert-live-off": "role=\"alert\" отключён через aria-live=\"off\"",
        "status-live-off": "role=\"status\" отключён через aria-live=\"off\"",
        "live-region-aria-hidden": "динамическая область скрыта от вспомогательных технологий",
        "empty-hidden-live-region": "пустая скрытая динамическая область",
        "error-message-not-assertive": "ошибка не объявляется в assertive-режиме",
        "status-message-without-live-region": "статусное сообщение без динамической области",
        "unannounced-status-container": "статусный контейнер не объявляется вспомогательными технологиями",
        "empty-id": "пустой id",
        "id-contains-whitespace": "id содержит пробельные символы",
        "duplicate-id": "дублирующийся id",
        "empty-id-reference": "пустая ссылка на id",
        "single-id-reference-has-multiple-values": "атрибут должен ссылаться только на один id",
        "broken-aria-id-reference": "ARIA-атрибут ссылается на несуществующий id",
        "broken-label-for-reference": "label[for] ссылается на несуществующий id",
        "broken-list-reference": "атрибут list ссылается на несуществующий datalist",
        "broken-table-headers-reference": "атрибут headers ссылается на несуществующий заголовок",
        "broken-fragment-reference": "якорная ссылка ведёт на несуществующий id",
        "empty-aria-current": "пустой aria-current",
        "invalid-aria-current": "нестандартное значение aria-current",
        "active-navigation-item-without-aria-current": "активный пункт навигации без aria-current",
        "aria-selected-used-instead-of-aria-current": "aria-selected используется вместо aria-current",
        "different-language-without-lang": "фрагмент на другом языке без lang"
    })[value] || String(value);
}

function translateDetailKey(key) {
    return ({
        criterion: "Критерий",
        issue: "Проблема",
        expected: "Ожидаемое исправление",
        currentAutocomplete: "Текущее значение autocomplete",
        expectedAutocomplete: "Ожидаемое значение autocomplete",
        fieldText: "Текст поля",
        accessibleName: "Доступное имя",
        describedByText: "Текст aria-describedby",
        ariaDescribedBy: "Значение aria-describedby",
        ariaErrorMessage: "Значение aria-errormessage",
        missingIds: "Отсутствующие id",
        missingId: "Отсутствующий id",
        attribute: "Атрибут",
        value: "Значение",
        currentValue: "Текущее значение",
        allowedValues: "Допустимые значения",
        activeHint: "Признак активного пункта",
        href: "Адрес ссылки",
        role: "Роль",
        ariaLive: "Значение aria-live",
        ariaAtomic: "Значение aria-atomic",
        ariaHidden: "Значение aria-hidden",
        selector: "Селектор",
        text: "Текст",
        sample: "Фрагмент текста",
        pageLang: "Язык страницы",
        detectedLang: "Определённый язык",
        detectedIso3: "Код языка ISO 639-3",
        confidence: "Уверенность определения",
        alternatives: "Альтернативы",
        tabIndex: "Значение tabindex",
        previousElement: "Предыдущий элемент",
        currentElement: "Текущий элемент",
        previousRect: "Область предыдущего элемента",
        currentRect: "Область текущего элемента",
        visibleLabel: "Видимая метка",
        accessibleLabel: "Доступная метка",
        controlColor: "Цвет элемента управления",
        borderColor: "Цвет границы",
        outlineColor: "Цвет обводки",
        shadowColor: "Цвет тени",
        graphicColor: "Цвет графики",
        backgroundColor: "Цвет фона",
        textColor: "Цвет текста",
        ratio: "Контраст",
        requiredRatio: "Требуемый контраст",
        fontSize: "Размер шрифта",
        fontWeight: "Насыщенность шрифта",
        detectedErrorText: "Найдённый текст ошибки",
        linkedErrorText: "Связанный текст ошибки",
        constraints: "Ограничения ввода",
        scrollWidth: "Ширина прокрутки",
        clientWidth: "Видимая ширина",
        scrollHeight: "Высота прокрутки",
        clientHeight: "Видимая высота"
    })[key] || key;
}

function downloadAsHTML(reportData){
    const standaloneReportData = prepareReportForStandalone(reportData);
    
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

.issues__list__details__summary__issue__default {
    background-color: #1a73e8;
    color: #ffffff;
}

.issues__list__details__summary__issue__warning {
    background-color: #f9ab00;
}

.issues__list__details__summary__issue__error {
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

.issues__list__details__guide-links {
    margin-top: .75rem;
    padding: .75rem;
    background-color: #e8f0fe;
    border-radius: 4px;
}

.issues__list__details__guide-links ul {
    margin: .4rem 0 0;
    padding-left: 1.2rem;
}

.issues__list__details__guide-links a {
    color: #174ea6;
}

.issues__list__details__extra {
    margin-top: .75rem;
}

.issues__list__details__extra dl {
    margin: .4rem 0 0;
}

.issues__list__details__extra dd {
    margin: 0 0 .35rem 1rem;
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
    var isAllIssuesElementsExpanded = true;

const popupBodyReport = document.getElementById("popup-body-report");

const summaryUrl = document.getElementById("summary--about--showurl");
const summaryDatetime = document.getElementById("summary--about--showdatetime");
const summaryTotalIssues = document.getElementById("summary--about--total");
const summaryWarnings = document.getElementById("summary--about--warnings");
const summaryErrors = document.getElementById("summary--about--errors");

const selectorByIssuesTypes = document.getElementById("selector-by-issues-types");
const selectorByCategories = document.getElementById("selector-by-categorys");
const btnAcceptFilters = document.getElementById("btn-accept-filters");
const btnResetFilters = document.getElementById("btn-reset-filters");
const btnExpandIssues = document.getElementById("btn-expand-issues");


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

function createGuideLinksElement(issue) {
    const links = Array.isArray(issue.guideLinks) ? issue.guideLinks : [];
    if (!links.length) return null;

    const container = document.createElement("div");
    container.classList.add("issues__list__details__guide-links");
    const title = document.createElement("strong");
    title.innerText = "\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:";
    container.appendChild(title);

    const list = document.createElement("ul");
    links.forEach(link => {
        const item = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.innerText = link.title;
        item.appendChild(anchor);
        list.appendChild(item);
    });
    container.appendChild(list);
    return container;
}



function generateIssue(position, issue){
    /* Создаёт развёртывающийся виджет для единичной проблемы */
    const cnt_category = Object.hasOwn(issue, "category") ? issue.category : "Категория не указана";
    const cnt_element = Object.hasOwn(issue, "element") ? issue.element : null;
    const cnt_message = (Object.hasOwn(issue, "message") ? issue.message : "Сообщение отсутствует");
    const cnt_selector = Object.hasOwn(issue, "selector") ? issue.selector : null;
    const cnt_type = Object.hasOwn(issue, "type") ? issue.type : "Не указано";

    let details = document.createElement("details");
    details.setAttribute("data-category", cnt_category);
    details.setAttribute("data-issue-type", cnt_type);
    details.classList.add("issues__list__details");
    details.id = "issues__list__issue__" + position;
    let summary = document.createElement("summary");
    summary.classList.add("issues__list__details__summary__issues");
    switch (cnt_type) {
        case "error":
            summary.classList.add("issues__list__details__summary__issue__error");
            break;
        case "warning":
            summary.classList.add("issues__list__details__summary__issue__warning");
            break;
        default:
            summary.classList.add("issues__list__details__summary__issue__default");
            break;
    }
    let summary_container = document.createElement("span");
    summary_container.classList.add("issues__list__details__title");
    let category_span = document.createElement("h3");
    category_span.innerHTML = "Проблема: " + (position + 1) + " > <strong>Категория</strong>: " + translateCategory(cnt_category);
    let span_issue_type = document.createElement("span");
    span_issue_type.innerText = translateIssueType(cnt_type);
    summary_container.appendChild(category_span);
    summary_container.appendChild(span_issue_type);
    summary.appendChild(summary_container);
    details.appendChild(summary);

    let details_contained = document.createElement("div");

    if (cnt_selector){
        details_contained.appendChild(createPairConstructElement("Селектор", cnt_selector));
    }

    details_contained.classList.add("issues__list__details__container");
    let p_message_title = document.createElement("strong");
    p_message_title.innerText = "Сообщение:";
    details_contained.appendChild(p_message_title);
    let p_message_text = document.createElement("p")
    p_message_text.innerText = cnt_message;
    details_contained.appendChild(p_message_text);
    
    if (cnt_element){
        let label_for_element_code = document.createElement("p");
        label_for_element_code.innerHTML = "<strong>Код элемента</strong>:";
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
        details_contained.appendChild(createPairConstructElement("Параметры контраста"));

        let contrastParametersContainer = document.createElement("div");
        contrastParametersContainer.style = "margin-left: .7rem;"

        contrastParametersContainer.appendChild(createPairConstructElement(
            "Оценка", translateContrastScore(issue.details.suggestions.score)
        ));

        contrastParametersContainer.appendChild(createPairConstructElement("Фон элемента:"));

        let listBackColorShowed = document.createElement("ul");
        [
            createPairConstructElement(
                "Цвет фона", issue.details.backgroundColor, issue.details.backgroundColor),
            createPairConstructElement(
                "Цвет текста", issue.details.textColor, issue.details.textColor),
            createPairConstructElement(
                "Размер шрифта", issue.details.fontSize),
            createPairConstructElement(
                "Насыщенность шрифта", issue.details.fontWeight),
            createPairConstructElement(
                "Контраст", issue.details.ratio),
            createPairConstructElement(
                "Требуемый контраст", issue.details.requiredRatio)
        ].forEach(item => {
            let itemShowed = document.createElement("li");
            itemShowed.appendChild(item);
            listBackColorShowed.appendChild(itemShowed);
        })
        contrastParametersContainer.appendChild(listBackColorShowed);
        details_contained.appendChild(contrastParametersContainer);

        

        if (issue.details.suggestions){
            contrastParametersContainer.appendChild(createPairConstructElement("Рекомендации:"));

            let suggestionDiv = document.createElement("div");
            suggestionDiv.style = "margin-left: 1rem;"
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Улучшение", translateImprovement(issue.details.suggestions.improvement)))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Текущий цвет", issue.details.suggestions.current, issue.details.suggestions.current))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Предлагаемый цвет", issue.details.suggestions.suggested, issue.details.suggestions.suggested))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Текущий контраст", issue.details.suggestions.currentRatio))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Предлагаемый контраст", issue.details.suggestions.suggestedRatio))
            contrastParametersContainer.appendChild(suggestionDiv);
        }
    } else if (issue.details) {
        const detailsListElement = createDetailsListElement(issue.details);
        if (detailsListElement) {
            details_contained.appendChild(detailsListElement);
        }
    }
    const guideLinksElement = createGuideLinksElement(issue);
    if (guideLinksElement) {
        details_contained.appendChild(guideLinksElement);
    }
    details.appendChild(details_contained);
    return details;
}

function showDetailsIssues(issues){
    const issuesList = document.getElementById("issues__list");
    issues.forEach((element, i) => {
        issuesList.appendChild(generateIssue(i, element));
    });

}

function getReportAsHTML(){
}

function initSelectorsForSorting(issuesElements){
    let issueTypes = new Set([...issuesElements].map((item) => item.getAttribute("data-issue-type")));
    issueTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = translateIssueType(item);
        opt.value = item;
        selectorByIssuesTypes.appendChild(opt);
    });
    let categoryTypes = new Set([...issuesElements].map((item) => item.getAttribute("data-category")));
    categoryTypes.forEach((item, i) => {
        let opt = document.createElement("option");
        opt.innerText = translateCategory(item);
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
    summaryTotalIssues.innerText = reportData.summary.total;
    summaryWarnings.innerText = reportData.summary.warnings;
    summaryErrors.innerText = reportData.summary.errors;
    showDetailsIssues(reportData.issues);

    const issuesElements = document.getElementsByClassName("issues__list__details");
    [...issuesElements].forEach(item => {
        item.addEventListener("click", function() {
            setTimeout(() => {
                isAllIssuesElementsExpanded = checkIsAllExpandedElements(issuesElements);
                btnExpandIssues.innerText = isAllIssuesElementsExpanded ? "Развернуть всё" : "Свернуть всё";
            }, 5)
            
        })
    });

    initSelectorsForSorting(issuesElements);

    btnAcceptFilters.addEventListener("click", function() {
        let filtersElements = [...issuesElements];
        let categoryValue = selectorByCategories.value;
        let issueTypeValue = selectorByIssuesTypes.value;
        filtersElements.forEach((item) => {
            item.classList.add("hidden");
        });
        if (categoryValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-category") === categoryValue
            );
        }
        if (issueTypeValue != "null"){
            filtersElements = filtersElements.filter(item => 
                item.getAttribute("data-issue-type") === issueTypeValue
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
    btnExpandIssues.addEventListener("click", function() {
        [...issuesElements].forEach(item => {
            item.toggleAttribute("open", isAllIssuesElementsExpanded);
        });
        isAllIssuesElementsExpanded = !isAllIssuesElementsExpanded;
        btnExpandIssues.innerText = isAllIssuesElementsExpanded ? "Развернуть всё" : "Свернуть всё";
    });   
}

function translateIssueType(type) {
    return ({ error: "ошибка", warning: "предупреждение" })[type] || (type || "не указано");
}

function translateCategory(category) {
    return ({
        images: "изображения",
        language: "язык страницы",
        "language-parts": "язык частей контента",
        headings: "заголовки",
        forms: "формы",
        contrast: "контраст",
        aria: "ARIA",
        keyboard: "клавиатура",
        semantics: "семантика",
        navigation: "навигация",
        links: "ссылки",
        interactive: "интерактивные элементы",
        syntax: "синтаксис",
        "page-title": "заголовок страницы",
        "non-text-contrast": "контраст нетекстовой информации",
        "text-spacing": "интервалы текста",
        "hover-focus-content": "контент при наведении и фокусе",
        "focus-order": "порядок фокуса",
        "keyboard-traps": "клавиатурные ловушки",
        "label-in-name": "метка в названии",
        "status-messages": "статусные сообщения",
        "form-assistance": "помощь при вводе",
        system: "система",
        general: "общее"
    })[category] || (category || "неизвестно");
}

function translateImprovement(improvement) {
    return ({ none: "не требуется", darken: "сделать темнее", lighten: "сделать светлее", error: "ошибка" })[improvement] || (improvement || "не указано");
}

function translateContrastScore(score) {
    return score === "Fail" ? "Не соответствует" : (score || "не указано");
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
                    <label for="selector-by-issues-types">По типу проблемы</label>
                    <select id="selector-by-issues-types">
                        <option value="null"> -- Не выбрано --</option>
                    </select>
                </div>
                <div class="issues__controls__selector">
                    <label for="selector-by-categorys">По категории</label>
                    <select id="selector-by-categorys">
                        <option value="null"> -- Не выбрано --</option>
                    </select>
                </div>
                <div class="issues__controls__buttons">
                    <button class="primary-btn" id="btn-expand-issues">Развернуть всё</button>
                    <div class="issues__controls__buttons__filters">
                        <button class="secondary-btn" id="btn-reset-filters">Сбросить фильтры</button>
                        <button class="primary-btn" id="btn-accept-filters">Применить фильтры</button>
                    </div>
                </div>
            </div>
            <div id="issues__list"></div>
        </main>
        <script>let currentReport = ${JSON.stringify(standaloneReportData)};</script>
        <script>${script}</script>
        <script>init(currentReport);</script>
</body>
</html>
    `
    const date = (new Date(reportData.timestamp)).toLocaleString('ru-RU');
    const formatter = date.replace(".", '_').replace(".", '_').replace(" ", '_').replace(",", "_").replace(":", "_"); 
    downloadFile(pageWithHTML, "report_" + formatter + ".html");
}

function translateIssueType(type) {
    return ({ error: "ошибка", warning: "предупреждение" })[type] || (type || "не указано");
}

function translateCategory(category) {
    return ({
        images: "изображения",
        language: "язык страницы",
        "language-parts": "язык частей контента",
        headings: "заголовки",
        forms: "формы",
        contrast: "контраст",
        aria: "ARIA",
        keyboard: "клавиатура",
        semantics: "семантика",
        navigation: "навигация",
        links: "ссылки",
        interactive: "интерактивные элементы",
        syntax: "синтаксис",
        "page-title": "заголовок страницы",
        "non-text-contrast": "контраст нетекстовой информации",
        "text-spacing": "интервалы текста",
        "hover-focus-content": "контент при наведении и фокусе",
        "focus-order": "порядок фокуса",
        "keyboard-traps": "клавиатурные ловушки",
        "label-in-name": "метка в названии",
        "status-messages": "статусные сообщения",
        "form-assistance": "помощь при вводе",
        system: "система",
        general: "общее"
    })[category] || (category || "неизвестно");
}

function translateImprovement(improvement) {
    return ({ none: "не требуется", darken: "сделать темнее", lighten: "сделать светлее", error: "ошибка" })[improvement] || (improvement || "не указано");
}

function translateContrastScore(score) {
    return score === "Fail" ? "Не соответствует" : (score || "не указано");
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
    let _report = "# Отчёт о доступности сайта\n";
    _report += "## Сводка\n\n";
    _report += "**Сайт:** " + reportData.url + "\n";
    _report += "**Время:** " + reportData.timestamp + "\n";
    _report += "**Всего проблем:** " + reportData.summary.total + "\n";
    _report += "**Предупреждений:** " + reportData.summary.warnings + "\n";
    _report += "**Ошибок:** " + reportData.summary.errors + "\n\n";
    _report += "## Детализация ошибок \n";
    reportData.issues.forEach((item, i) => {
        _report += "### **Проблема:** " + (i + 1) + "\n\n";
        _report += "**Тип:** " + translateIssueType(item.type) + "\n";
        _report += "**Категория:** " + translateCategory(item.category) + "\n"
        _report += "**Сообщение:** " + item.message + "\n";
        _report += item.selector ? "**Селектор:** " + item.selector + "\n" : "";
        _report += item.element ? formatElementMarkdown(item.element) : "";
        if (item.category === "contrast"){
            _report += "#### Параметры контраста\n\n";
            _report += "**Оценка:** " + translateContrastScore(item.details.suggestions.score) + "\n";
            _report += "**Улучшение:** " + translateImprovement(item.details.suggestions.improvement) + "\n\n"
            _report += "##### Информация о фоне\n\n"
            _report += "**Цвет фона:** " + item.details.backgroundColor + "\n";
            _report += "**Размер шрифта:** " + item.details.fontSize + "\n";
            _report += "**Насыщенность шрифта:** " + item.details.fontWeight + "\n";
            _report += "**Контраст:** " + item.details.ratio + "\n";
            _report += "**Требуемый контраст:** " + item.details.requiredRatio + "\n";
            _report += "**Цвет текста:** " + item.details.textColor + "\n";
            _report += "##### Текущий цвет\n\n";
            _report += "**Цвет:**\n";
            _report += " - **RGB:** " + item.details.suggestions.current + "\n";
            _report += " - **HEX:** " + item.details.suggestions.currentHex + "\n\n";
            _report += "**Контраст:** " + item.details.suggestions.currentRatio + "\n";
            _report += "##### Рекомендации\n\n";
            _report += "**Предлагаемый цвет:** \n";
            _report += " - **RGB:** " + item.details.suggestions.suggested + "\n";
            _report += " - **HEX:** " + item.details.suggestions.suggestedHex + "\n\n";
            _report += "**Контраст:** " + item.details.suggestions.suggestedRatio + "\n";
        } else if (item.details) {
            _report += formatDetailsMarkdown(item.details);
        }
        _report += formatGuideLinksMarkdown(item);
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
        currentReport = prepareReportForStandalone(result.currentReport);
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
