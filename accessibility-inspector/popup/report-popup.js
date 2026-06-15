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
        valueContainer.style = `display: inline-flex;flex-direction: row;align-items: center;`
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
    const links = typeof DokaGuideLinks !== "undefined" && typeof DokaGuideLinks.getLinks === "function"
        ? DokaGuideLinks.getLinks(issue)
        : [];
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

function formatDetailValue(value, key = "") {
    if (value === null || value === undefined || value === "") return "не указано";
    if (Array.isArray(value)) return value.length ? value.map(item => formatDetailValue(item, key)).join("; ") : "нет данных";
    if (typeof value === "object") {
        return Object.entries(value).map(([itemKey, itemValue]) => `${translateDetailKey(itemKey)}: ${formatDetailValue(itemValue, itemKey)}`).join("; ");
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
