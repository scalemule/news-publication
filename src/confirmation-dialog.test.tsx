// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {useConfirmation} from './confirmation-dialog';

beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(()=>{cleanup();vi.restoreAllMocks();document.body.style.overflow='';});
function Harness({decide}:{decide:(accepted:boolean)=>void}){
 const {requestConfirmation,confirmationDialog}=useConfirmation();
 return <><button onClick={async event=>decide(await requestConfirmation({title:'Change review policy?',description:<p>Reviewer feedback will be kept.</p>,confirmLabel:'Save review policy'},event.currentTarget))}>Review change</button>{confirmationDialog}</>;
}
it('focuses Cancel, labels the consequence, and restores focus without accepting',async()=>{
 const decide=vi.fn();render(<Harness decide={decide}/>);
 const trigger=screen.getByRole('button',{name:'Review change'});fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Change review policy?'});
 expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Reviewer feedback will be kept.');
 const cancel=within(dialog).getByRole('button',{name:'Cancel'});
 expect(document.activeElement).toBe(cancel);expect(document.body.style.overflow).toBe('hidden');
 fireEvent.click(cancel);
 await waitFor(()=>expect(decide).toHaveBeenCalledWith(false));
 expect(document.activeElement).toBe(trigger);expect(document.body.style.overflow).toBe('');
});
it('cancels on Escape without closing an underlying response panel',async()=>{
 const decide=vi.fn(),underlyingEscape=vi.fn();window.addEventListener('keydown',underlyingEscape);
 render(<Harness decide={decide}/>);fireEvent.click(screen.getByText('Review change'));
 const dialog=screen.getByRole('dialog');fireEvent.keyDown(dialog,{key:'Escape'});
 expect(underlyingEscape).not.toHaveBeenCalled();
 fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));
 await waitFor(()=>expect(decide).toHaveBeenCalledWith(false));
 expect(screen.queryByRole('dialog')).toBeNull();window.removeEventListener('keydown',underlyingEscape);
});
it('requires the named action and resolves it only once',async()=>{
 const decide=vi.fn();render(<Harness decide={decide}/>);fireEvent.click(screen.getByText('Review change'));
 const accept=screen.getByRole('button',{name:'Save review policy'});fireEvent.click(accept);fireEvent.click(accept);
 await waitFor(()=>expect(decide).toHaveBeenCalledTimes(1));expect(decide).toHaveBeenCalledWith(true);
});
it('cancels a pending decision when its owner unmounts',async()=>{
 const decide=vi.fn();const view=render(<Harness decide={decide}/>);fireEvent.click(screen.getByText('Review change'));view.unmount();
 await waitFor(()=>expect(decide).toHaveBeenCalledWith(false));expect(document.body.style.overflow).toBe('');
});
