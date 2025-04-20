import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrthagonalComponent } from './orthagonal.component';

describe('OrthagonalComponent', () => {
  let component: OrthagonalComponent;
  let fixture: ComponentFixture<OrthagonalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrthagonalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrthagonalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
