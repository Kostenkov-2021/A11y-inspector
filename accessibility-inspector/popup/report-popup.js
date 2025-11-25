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



function generateIssue(position, issue){
    /* Создает развертывающийся виджет для единичной проблемы */
    const cnt_category = Object.hasOwn(issue, "category") ? issue.category : "Категория не указана";
    const cnt_element = Object.hasOwn(issue, "element") ? issue.element : null;
    const cnt_message = (Object.hasOwn(issue, "message") ? issue.message : "Сообщение отсутсвует");
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
    category_span.innerHTML = "Issue: " + position + " > <strong>Category</strong>: " + cnt_category;
    let span_issue_type = document.createElement("span");
    span_issue_type.innerText = cnt_type;
    summary_container.appendChild(category_span);
    summary_container.appendChild(span_issue_type);
    summary.appendChild(summary_container);
    details.appendChild(summary);

    let details_contained = document.createElement("div");

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
            "Score", issue.details.suggestions.score
        ));

        contrastParametersContainer.appendChild(createPairConstructElement("Background element:"));

        let listBackColorShowed = document.createElement("ul");
        [
            createPairConstructElement(
                "backroundColor", issue.details.backgroundColor, issue.details.backgroundColor),
            createPairConstructElement(
                "textColor", issue.details.textColor, issue.details.textColor),
            createPairConstructElement(
                "fontSize", issue.details.fontSize),
            createPairConstructElement(
                "fontWeight", issue.details.fontWeight),
            createPairConstructElement(
                "ratio", issue.details.ratio),
            createPairConstructElement(
                "requiredRatio", issue.details.requiredRatio)
        ].forEach(item => {
            let itemShowed = document.createElement("li");
            itemShowed.appendChild(item);
            listBackColorShowed.appendChild(itemShowed);
        })
        contrastParametersContainer.appendChild(listBackColorShowed);
        details_contained.appendChild(contrastParametersContainer);

        

        if (issue.details.suggestions){
            contrastParametersContainer.appendChild(createPairConstructElement("Suggestions:"));

            let suggestionDiv = document.createElement("div");
            suggestionDiv.style = "margin-left: 1rem;"
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Improvement", issue.details.suggestions.improvement))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Current color", issue.details.suggestions.current, issue.details.suggestions.current))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Suggestion color", issue.details.suggestions.suggested, issue.details.suggestions.suggested))
            suggestionDiv.appendChild(document.createElement("hr"));
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Current ratio", issue.details.suggestions.currentRatio))
            suggestionDiv.appendChild(
                createPairConstructElement(
                    "Suggestion ratio", issue.details.suggestions.suggestedRatio))
            contrastParametersContainer.appendChild(suggestionDiv);
        }
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
        opt.innerText = item;
        opt.value = item;
        selectorByIssueTypes.appendChild(opt);
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
    summaryTotalIssues.innerText = reportData.summary.total;
    summaryWarnings.innerText = reportData.summary.warnings;
    summaryErrors.innerText = reportData.summary.errors;
    showDetailsIssues(reportData.issues);

    const issuesElements = document.getElementsByClassName("issues__list__details");
    [...issuesElements].forEach(item => {
        item.addEventListener("click", function() {
            setTimeout(() => {
                isAllIssuesElementsExpanded = checkIsAllExpandedElements(issuesElements);
                btnExpandIssues.innerText = isAllIssuesElementsExpanded ? "Expand all" : "Hide All";
            }, 5)
            
        })
    });

    initSelectorsForSorting(issuesElements);

    btnAcceptFilters.addEventListener("click", function() {
        let filtersElements = [...issuesElements];
        let categoryValue = selectorByCategories.value;
        let issueTypeValue = selectorByIssueTypes.value;
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
        selectorByIssueTypes.value = "null";
    });
    btnExpandIssues.addEventListener("click", function() {
        [...issuesElements].forEach(item => {
            item.toggleAttribute("open", isAllIssuesElementsExpanded);
        });
        isAllIssuesElementsExpanded = !isAllIssuesElementsExpanded;
        btnExpandIssues.innerText = isAllIssuesElementsExpanded ? "Expand all" : "Hide All";
    });   
}