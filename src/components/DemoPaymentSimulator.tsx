'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { DEMO_PAYMENT_OPTIONS, simulateDemoPayment, type DemoPaymentMethod } from '../lib/original-store-content';
import { Icon } from './Icon';

export function DemoPaymentSimulator() {
  const [selected, setSelected] = useState<DemoPaymentMethod | ''>('');
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setValidationError('اختر وسيلة تجريبية أولًا.');
      return;
    }
    setValidationError('');
    setMessage(simulateDemoPayment(selected));
  }

  return (
    <section className="card" data-demo-mode="true">
      <h2>تجربة وسائل الدفع — محاكاة للعرض فقط</h2>
      <p className="muted">هذه تجربة واجهة منفصلة عن إتمام الطلب. لا تطلب بيانات دفع، ولا تتصل بمزوّد أو تنشئ معاملة.</p>
      <form onSubmit={simulate}>
        <fieldset>
          <legend>اختر وسيلة تجريبية</legend>
          <div className="grid">
            {DEMO_PAYMENT_OPTIONS.map((option) => (
              <label className="card radio" key={option.id}>
                <input
                  type="radio"
                  name="demoPayment"
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => { setSelected(option.id); setMessage(''); setValidationError(''); }}
                />
                {option.image ? <Image className="payment-demo-logo" src={option.image} alt="" width={64} height={44} /> : <Icon name="card" />}
                <span>
                  <b>{option.label} — تجريبي</b>
                  <span className="muted">{option.description}</span>
                  {'providers' in option && <span className="payment-demo-providers">{option.providers.map((provider) => (
                    <span className="payment-demo-provider" key={provider.name}>
                      <Image className="payment-demo-provider-logo" src={provider.image} alt="" width={24} height={24} />
                      {provider.name}
                    </span>
                  ))}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {validationError && <div className="msg err" role="alert">{validationError}</div>}
        <button className="btn" type="submit">محاكاة الاختيار</button>
      </form>
      {message && <div className="msg info" role="status">{message}</div>}
    </section>
  );
}
