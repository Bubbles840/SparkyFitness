import fs from 'fs';
import path from 'path';

describe('Expo native language configuration', () => {
  it('retains the native locale configuration and localized metadata settings', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../app.config.ts'),
      'utf8'
    );
    expect(source).toContain('nativeLanguageTags()');
    expect(source).toContain('supportedLocales');
    expect(source).not.toContain("ios: ['en', 'pl']");
    expect(source).not.toContain("android: ['en', 'pl']");
    expect(source).toContain('UIPrefersShowingLanguageSettings: true');
    expect(source).toContain('CFBundleAllowMixedLocalizations: true');
  });
});

describe('Health Connect mindfulness permissions', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../app.config.ts'),
    'utf8'
  );
  const block = (name: string) => {
    const start = source.indexOf(`const ${name} = [`);
    return source.slice(start, source.indexOf('];', start));
  };

  it('reads mindfulness in every build and writes it only for the dev seeder', () => {
    expect(block('androidPermissions')).toContain(
      "'android.permission.health.READ_MINDFULNESS'"
    );
    expect(block('androidPermissions')).not.toContain('WRITE_MINDFULNESS');
    expect(block('devAndroidPermissions')).toContain(
      "'android.permission.health.WRITE_MINDFULNESS'"
    );
  });
});
