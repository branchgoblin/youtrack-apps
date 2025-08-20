import React, {memo, useRef, useEffect, useState} from 'react';
import API from './api';
import type { EmbeddableWidgetAPI } from '../../../@types/globals';
import type { WidgetRef } from './components/documents-list-widget';
import DocumentsListWidget from './components/documents-list-widget';
import WidgetContext from './widget-context';

interface WidgetAPI {
  api: API | null;
  dashboardApi: EmbeddableWidgetAPI | null;
}

export const AppComponent = () => {
  const widgetRef = useRef<WidgetRef>(null);

  const [services, setServices] = useState<WidgetAPI>({
    api: null,
    dashboardApi: null
  });

  useEffect(() => {
    const registerApp = async () => {
      const host = await YTApp.register({
        onConfigure: () => widgetRef.current?.enterConfigMode(),
        onRefresh: () => widgetRef.current?.refreshWidget(),
      });

      setServices({
        api: new API(host),
        dashboardApi: host as EmbeddableWidgetAPI
      });
    };

    registerApp();
  }, []);

  const {api, dashboardApi} = services;

  if (!api || !dashboardApi) {
    return null;
  }

  return (
    <WidgetContext.Provider value={{api, dashboardApi}}>
      <DocumentsListWidget ref={widgetRef}/>
    </WidgetContext.Provider>
  );
};

export const App = memo(AppComponent);