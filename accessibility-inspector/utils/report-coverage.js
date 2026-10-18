(function(root) {
  'use strict';

  function describe(coverage) {
    const patternNames = { accordion: 'Аккордеон', alert: 'Оповещение', alertdialog: 'Диалог оповещения', breadcrumb: 'Навигационная цепочка', button: 'Кнопка',
      carousel: 'Карусель', checkbox: 'Флажок', combobox: 'Комбинированный список', dialog: 'Модальный диалог', disclosure: 'Раскрываемый блок',
      feed: 'Лента', grid: 'Интерактивная сетка', landmarks: 'Области страницы', link: 'Ссылка', listbox: 'Список вариантов',
      'menu-menubar': 'Меню и строка меню', 'menu-button': 'Кнопка меню', meter: 'Измеритель', 'radio-group': 'Группа радиокнопок',
      slider: 'Ползунок', 'slider-multithumb': 'Ползунок с несколькими бегунками', spinbutton: 'Числовое поле', switch: 'Переключатель',
      table: 'Таблица', tabs: 'Вкладки', toolbar: 'Панель инструментов', tooltip: 'Подсказка', 'tree-view': 'Дерево', treegrid: 'Древовидная сетка', 'window-splitter': 'Разделитель панелей' };
    const scenario = coverage && coverage.scenarios;
    const prefix = [];
    if (coverage?.status) prefix.push('Охват автоматического прогона: ' + (coverage.status === 'completed' ? 'без обнаруженного усечения' : 'неполный') + '.');
    for (const [scope, records] of [['Основные проверки', coverage?.limits], ['Сценарные проверки', scenario?.limits], ['Пользовательский сценарий', coverage?.workflow?.limits]]) {
      if (!records?.length) continue;
      prefix.push(scope + ': количественных ограничений: ' + records.length + ', с усечением: ' + records.filter(record => record.truncated).length + '.');
      for (const record of records.filter(record => record.truncated)) prefix.push('Лимит «' + record.label + '»: отобрано ' + record.processed + ', всего ' + (record.totalIsLowerBound ? 'не менее ' : '') + record.total + ', ограничение ' + record.limit + '.');
    }
    if (coverage?.profile) prefix.push('Профиль: ' + coverage.profile.standards.join(', ') + '; уровень ' + coverage.profile.level + '.');
    if (coverage?.notTested?.length) prefix.push('Не выполнено автоматических измерений: ' + coverage.notTested.length + '. Это ограничения проверки, а не найденные нарушения.');
    for (const session of [scenario, coverage?.workflow]) {
      if (session?.debugger) prefix.push('Отладчик подключался: ' + (session.debugger.attached ? 'да' : 'нет') + '; отсоединён: ' + (session.debugger.detached ? 'да' : 'нет') + '.');
      if (session?.debugger?.connectionLost) {
        const reasons = { target_closed: 'вкладка закрыта', canceled_by_user: 'подключение завершено извне', not_attached: 'подключение отсутствует' };
        prefix.push('Соединение с отладчиком потеряно: ' + (reasons[session.debugger.detachReason] || 'причина не установлена') + '.');
      }
      const observations = session?.mediaObservations || (session?.mediaObservation ? [session.mediaObservation] : []);
      for (const observation of observations) prefix.push('Наблюдение медиа: ' + observation.durationMs + ' мс; элементов: ' + observation.elements.length + '; сохранено событий: ' + observation.events.length + '. ' + observation.limitation);
      for (const observation of session?.statusObservations || []) prefix.push('Наблюдение статусов: ' + observation.durationMs + ' мс; сохранено изменений: ' + observation.events.length + '. Фактические объявления скринридером не подтверждаются.');
      for (const player of session?.playerObservations || []) prefix.push('Пользовательский медиаплеер: ' + player.selector + '; медиаэлементов: ' + player.media.length + '; элементов управления: ' + player.controls.length + '. ' + player.limitation);
      if (session?.webAudioObservation) {
        const observation = session.webAudioObservation;
        prefix.push('Наблюдение Web Audio: ' + (observation.enabled ? 'включалось' : 'недоступно') + '; контекстов: ' + observation.contexts.length + '; сохранено событий: ' + observation.events.length + '. ' + observation.limitation);
        for (const error of observation.errors) prefix.push('Диагностика Web Audio: ' + error);
      }
      for (const observation of session?.patternObservations || []) prefix.push('Наблюдение ARIA-паттерна «' + (patternNames[observation.pattern] || 'неизвестный паттерн') + '»: элементов ' + observation.elements.length + '. ' + observation.limitation);
      for (const observation of session?.dragObservations || []) prefix.push('Краевая автопрокрутка: ' + (observation.completed ? 'цель достигнута' : 'не завершена') + '; итераций: ' + observation.ticks + '; резервных прокруток: ' + (observation.assistedScrolls || 0) + '; время: ' + observation.durationMs + ' мс.');
    }
    const workflowSteps = coverage?.workflow?.steps || [];
    if (workflowSteps.length) prefix.push('Подтверждение шагов: постусловие — ' + workflowSteps.filter(step => step.confirmation === 'postcondition').length + '; ожидаемый текст — ' + workflowSteps.filter(step => step.confirmation === 'expected-text').length + '; состояние поля — ' + workflowSteps.filter(step => step.confirmation === 'control-state').length + '; только наблюдение — ' + workflowSteps.filter(step => step.confirmation === 'observation-only').length + '; только отправка действия — ' + workflowSteps.filter(step => step.confirmation === 'dispatch-only').length + '.');
    if (coverage?.workflow) prefix.push('Пользовательский сценарий: ' + (coverage.workflow.status === 'completed' ? 'выполнен' : 'выполнен частично') + '; шагов: ' + coverage.workflow.steps.length + '.', ...coverage.workflow.limitations);
    if (!scenario) return prefix.join('\n');
    const phases = { reflow: 'адаптация контента', 'text-resize': 'увеличение текста', keyboard: 'клавиатурный фокус', tooltips: 'подсказки', 'status-observation': 'наблюдение статусов', 'media-observation': 'наблюдение медиа' };
    const completed = (scenario.completedPhases || []).map(phase => phases[phase]).filter(Boolean);
    const steps = (scenario.keyboard || []).reduce((sum, item) => sum + (Number(item.steps) || 0), 0);
    return [
      ...prefix,
      'Сценарные проверки: ' + (scenario.status === 'completed' ? 'выполнены' : 'выполнены частично') + '.',
      'Завершённые этапы: ' + (completed.join(', ') || 'нет') + '.',
      'Проверено переходов Tab / Shift+Tab: ' + steps + '.',
      'Охват ограничен основным документом и открытыми Shadow DOM; содержимое iframe не проверяется.',
      'Геометрические результаты требуют ручной проверки; отсутствие замечаний не подтверждает соответствие WCAG.'
    ].join('\n');
  }

  root.A11yReportCoverage = { describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.A11yReportCoverage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
