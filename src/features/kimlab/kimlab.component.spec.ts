import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KimlabComponent } from './kimlab.component';

describe('KimlabComponent', () => {
  let component: KimlabComponent;
  let fixture: ComponentFixture<KimlabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KimlabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KimlabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
