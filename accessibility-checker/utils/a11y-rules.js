const A11yRules = {
  // Rules for checking images
  images: {
    missingAlt: {
      check: (img) => !img.hasAttribute('alt'),
      message: 'Изображение без атрибута alt',
      type: 'error'
    },
    emptyAlt: {
      check: (img) => img.getAttribute('alt') === '',
      message: 'Атрибут alt пустой (декоративное изображение)',
      type: 'warning'
    }
  },

  // Rules for forms
  forms: {
    missingLabel: {
      check: (input) => {
        if (!input.id) return true;
        const label = document.querySelector(`label[for="${input.id}"]`);
        return !label;
      },
      message: 'Поле формы без связанной метки',
      type: 'error'
    }
  },

  // Rules for navigation
  navigation: {
    missingSkipLinks: {
      check: () => {
        const skipLinks = document.querySelectorAll('[href^="#main"], [href^="#content"]');
        return skipLinks.length === 0;
      },
      message: 'Отсутствуют ссылки для пропуска навигации',
      type: 'warning'
    }
  }
};

export default A11yRules;