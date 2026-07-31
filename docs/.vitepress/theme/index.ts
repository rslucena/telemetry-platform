import DefaultTheme from 'vitepress/theme';
import InteractiveFlow from './components/InteractiveFlow.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('InteractiveFlow', InteractiveFlow);
  },
};
